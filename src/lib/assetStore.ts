/**
 * assetStore
 *
 * IndexedDB-backed asset storage with:
 * - SHA-256 blob deduplication
 * - ref-counted blob lifecycle
 * - LRU Object URL cache
 *
 * Data model (DB v2):
 * - assetRefs   : assetId -> { assetId, hash }
 * - blobsByHash : hash    -> { hash, blob, refCount }
 * - meta        : key/value flags
 *
 * Legacy model (DB v1):
 * - blobs       : assetId -> Blob
 */

const DB_NAME = "author-studio-assets";
const DB_VERSION = 2;

const LEGACY_BLOBS_STORE = "blobs";
const ASSET_REFS_STORE = "assetRefs";
const BLOBS_BY_HASH_STORE = "blobsByHash";
const META_STORE = "meta";
const META_KEY_LEGACY_MIGRATED = "legacyMigratedToV2";

type AssetRefRecord = {
  assetId: string;
  hash: string;
};

type BlobRecord = {
  hash: string;
  blob: Blob;
  refCount: number;
};

const MAX_URLS = 200;
const urlCache = new Map<string, string>(); // assetId -> objectURL (insertion order)
const pendingWriteByAssetId = new Map<string, Promise<void>>();
let migrationPromise: Promise<void> | null = null;

function revokeCachedObjectURL(assetId: string): void {
  const url = urlCache.get(assetId);
  if (!url) return;
  URL.revokeObjectURL(url);
  urlCache.delete(assetId);
}

function evictLRU(): void {
  while (urlCache.size > MAX_URLS) {
    const oldest = urlCache.keys().next().value;
    if (typeof oldest !== "string") break;
    revokeCachedObjectURL(oldest);
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ASSET_REFS_STORE)) {
        const refStore = db.createObjectStore(ASSET_REFS_STORE, { keyPath: "assetId" });
        refStore.createIndex("by_hash", "hash", { unique: false });
      } else {
        const refStore = request.transaction?.objectStore(ASSET_REFS_STORE);
        if (refStore && !refStore.indexNames.contains("by_hash")) {
          refStore.createIndex("by_hash", "hash", { unique: false });
        }
      }

      if (!db.objectStoreNames.contains(BLOBS_BY_HASH_STORE)) {
        db.createObjectStore(BLOBS_BY_HASH_STORE, { keyPath: "hash" });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getMetaBoolean(db: IDBDatabase, key: string): Promise<boolean> {
  const transaction = db.transaction(META_STORE, "readonly");
  const store = transaction.objectStore(META_STORE);
  const done = waitForTransaction(transaction);
  const value = await requestToPromise(store.get(key));
  await done;
  return value === true;
}

async function setMetaBoolean(db: IDBDatabase, key: string, value: boolean): Promise<void> {
  const transaction = db.transaction(META_STORE, "readwrite");
  const store = transaction.objectStore(META_STORE);
  const done = waitForTransaction(transaction);
  await requestToPromise(store.put(value, key));
  await done;
}

async function listLegacyAssetIds(db: IDBDatabase): Promise<string[]> {
  if (!db.objectStoreNames.contains(LEGACY_BLOBS_STORE)) return [];

  const transaction = db.transaction(LEGACY_BLOBS_STORE, "readonly");
  const store = transaction.objectStore(LEGACY_BLOBS_STORE);
  const done = waitForTransaction(transaction);
  const rawKeys = await requestToPromise(store.getAllKeys());
  await done;

  return rawKeys.filter((key): key is string => typeof key === "string");
}

async function getLegacyBlob(db: IDBDatabase, assetId: string): Promise<Blob | null> {
  if (!db.objectStoreNames.contains(LEGACY_BLOBS_STORE)) return null;

  const transaction = db.transaction(LEGACY_BLOBS_STORE, "readonly");
  const store = transaction.objectStore(LEGACY_BLOBS_STORE);
  const done = waitForTransaction(transaction);
  const value = await requestToPromise(store.get(assetId));
  await done;

  return value instanceof Blob ? value : null;
}

async function clearLegacyBlobs(db: IDBDatabase): Promise<void> {
  if (!db.objectStoreNames.contains(LEGACY_BLOBS_STORE)) return;

  const transaction = db.transaction(LEGACY_BLOBS_STORE, "readwrite");
  const store = transaction.objectStore(LEGACY_BLOBS_STORE);
  const done = waitForTransaction(transaction);
  await requestToPromise(store.clear());
  await done;
}

export async function computeAssetBlobSha256(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API unavailable: cannot compute SHA-256.");
  }

  const arrayBuffer = await blob.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", arrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function putAssetBlobWithDb(db: IDBDatabase, assetId: string, blob: Blob): Promise<void> {
  const hash = await computeAssetBlobSha256(blob);

  const transaction = db.transaction([ASSET_REFS_STORE, BLOBS_BY_HASH_STORE], "readwrite");
  const refs = transaction.objectStore(ASSET_REFS_STORE);
  const blobs = transaction.objectStore(BLOBS_BY_HASH_STORE);
  const done = waitForTransaction(transaction);

  const currentRef = (await requestToPromise(refs.get(assetId)) as AssetRefRecord | undefined) ?? null;

  if (currentRef?.hash === hash) {
    const existingBlobRecord =
      (await requestToPromise(blobs.get(hash)) as BlobRecord | undefined) ?? null;
    if (!existingBlobRecord) {
      await requestToPromise(
        blobs.put({
          hash,
          blob,
          refCount: 1,
        } satisfies BlobRecord),
      );
    }
    await done;
    return;
  }

  if (currentRef?.hash) {
    const previousBlobRecord =
      (await requestToPromise(blobs.get(currentRef.hash)) as BlobRecord | undefined) ?? null;
    if (previousBlobRecord) {
      const nextRefCount = previousBlobRecord.refCount - 1;
      if (nextRefCount > 0) {
        await requestToPromise(
          blobs.put({
            ...previousBlobRecord,
            refCount: nextRefCount,
          } satisfies BlobRecord),
        );
      } else {
        await requestToPromise(blobs.delete(currentRef.hash));
      }
    }
  }

  const nextBlobRecord = (await requestToPromise(blobs.get(hash)) as BlobRecord | undefined) ?? null;
  if (nextBlobRecord) {
    await requestToPromise(
      blobs.put({
        ...nextBlobRecord,
        refCount: nextBlobRecord.refCount + 1,
      } satisfies BlobRecord),
    );
  } else {
    await requestToPromise(
      blobs.put({
        hash,
        blob,
        refCount: 1,
      } satisfies BlobRecord),
    );
  }

  await requestToPromise(
    refs.put({
      assetId,
      hash,
    } satisfies AssetRefRecord),
  );

  await done;
}

async function deleteAssetBlobsWithDb(db: IDBDatabase, assetIds: string[]): Promise<void> {
  const uniqueAssetIds = Array.from(new Set(assetIds.filter(Boolean)));
  if (uniqueAssetIds.length === 0) return;

  const transaction = db.transaction([ASSET_REFS_STORE, BLOBS_BY_HASH_STORE], "readwrite");
  const refs = transaction.objectStore(ASSET_REFS_STORE);
  const blobs = transaction.objectStore(BLOBS_BY_HASH_STORE);
  const done = waitForTransaction(transaction);
  const removalsByHash = new Map<string, number>();

  for (const assetId of uniqueAssetIds) {
    const ref = (await requestToPromise(refs.get(assetId)) as AssetRefRecord | undefined) ?? null;
    if (!ref) continue;

    removalsByHash.set(ref.hash, (removalsByHash.get(ref.hash) ?? 0) + 1);
    await requestToPromise(refs.delete(assetId));
  }

  for (const [hash, removeCount] of removalsByHash) {
    const blobRecord = (await requestToPromise(blobs.get(hash)) as BlobRecord | undefined) ?? null;
    if (!blobRecord) continue;

    const nextRefCount = blobRecord.refCount - removeCount;
    if (nextRefCount > 0) {
      await requestToPromise(
        blobs.put({
          ...blobRecord,
          refCount: nextRefCount,
        } satisfies BlobRecord),
      );
    } else {
      await requestToPromise(blobs.delete(hash));
    }
  }

  await done;
}

async function getBlobByAssetIdWithDb(db: IDBDatabase, assetId: string): Promise<Blob | null> {
  const transaction = db.transaction([ASSET_REFS_STORE, BLOBS_BY_HASH_STORE], "readonly");
  const refs = transaction.objectStore(ASSET_REFS_STORE);
  const blobs = transaction.objectStore(BLOBS_BY_HASH_STORE);
  const done = waitForTransaction(transaction);

  const ref = (await requestToPromise(refs.get(assetId)) as AssetRefRecord | undefined) ?? null;
  if (!ref) {
    await done;
    return null;
  }

  const blobRecord = (await requestToPromise(blobs.get(ref.hash)) as BlobRecord | undefined) ?? null;
  await done;
  return blobRecord?.blob ?? null;
}

async function migrateLegacyStoreIfNeeded(db: IDBDatabase): Promise<void> {
  const alreadyMigrated = await getMetaBoolean(db, META_KEY_LEGACY_MIGRATED);
  if (alreadyMigrated) return;

  const legacyAssetIds = await listLegacyAssetIds(db);
  for (const assetId of legacyAssetIds) {
    const blob = await getLegacyBlob(db, assetId);
    if (!blob) continue;
    await putAssetBlobWithDb(db, assetId, blob);
  }

  await clearLegacyBlobs(db);
  await setMetaBoolean(db, META_KEY_LEGACY_MIGRATED, true);
}

async function withReadyDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDB();

  if (!migrationPromise) {
    migrationPromise = migrateLegacyStoreIfNeeded(db).catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  await migrationPromise;

  return fn(db);
}

function queueAssetWrite(assetId: string, writeTask: () => Promise<void>): Promise<void> {
  const previous = pendingWriteByAssetId.get(assetId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(writeTask);

  pendingWriteByAssetId.set(assetId, next);

  return next.finally(() => {
    if (pendingWriteByAssetId.get(assetId) === next) {
      pendingWriteByAssetId.delete(assetId);
    }
  });
}

async function waitForPendingAssetWrites(assetIds: string[]): Promise<void> {
  const pending = assetIds
    .map((assetId) => pendingWriteByAssetId.get(assetId))
    .filter((entry): entry is Promise<void> => Boolean(entry));

  if (pending.length === 0) return;
  await Promise.allSettled(pending);
}

async function waitForAllPendingWrites(): Promise<void> {
  const pending = Array.from(pendingWriteByAssetId.values());
  if (pending.length === 0) return;
  await Promise.allSettled(pending);
}

/** Store a Blob/File in IndexedDB under the given assetId (deduplicated by SHA-256 hash). */
export async function putAssetBlob(assetId: string, blob: Blob): Promise<void> {
  return queueAssetWrite(assetId, async () => {
    await withReadyDb((db) => putAssetBlobWithDb(db, assetId, blob));
    revokeCachedObjectURL(assetId);
  });
}

/** Retrieve a Blob from IndexedDB (or null if missing). */
export async function getAssetBlob(assetId: string): Promise<Blob | null> {
  await waitForPendingAssetWrites([assetId]);
  return withReadyDb((db) => getBlobByAssetIdWithDb(db, assetId));
}

/** Check whether an asset exists in IndexedDB without reading the blob. */
export async function hasAssetBlob(assetId: string): Promise<boolean> {
  await waitForPendingAssetWrites([assetId]);
  return withReadyDb(async (db) => {
    const transaction = db.transaction(ASSET_REFS_STORE, "readonly");
    const store = transaction.objectStore(ASSET_REFS_STORE);
    const done = waitForTransaction(transaction);
    const ref = await requestToPromise(store.get(assetId));
    await done;
    return Boolean(ref);
  });
}

/** Delete one asset from IndexedDB and revoke its Object URL if cached. */
export async function deleteAssetBlob(assetId: string): Promise<void> {
  await deleteAssetBlobs([assetId]);
}

/** Delete many assets at once. */
export async function deleteAssetBlobs(assetIds: string[]): Promise<void> {
  const uniqueAssetIds = Array.from(new Set(assetIds.filter(Boolean)));
  if (uniqueAssetIds.length === 0) return;

  await waitForPendingAssetWrites(uniqueAssetIds);
  for (const assetId of uniqueAssetIds) {
    revokeCachedObjectURL(assetId);
  }

  await withReadyDb((db) => deleteAssetBlobsWithDb(db, uniqueAssetIds));
}

/** Clear all local asset data and Object URL caches. */
export async function clearAllAssetBlobs(): Promise<void> {
  await waitForAllPendingWrites();

  for (const url of urlCache.values()) {
    URL.revokeObjectURL(url);
  }
  urlCache.clear();

  await withReadyDb(async (db) => {
    const storeNames = [ASSET_REFS_STORE, BLOBS_BY_HASH_STORE];
    if (db.objectStoreNames.contains(LEGACY_BLOBS_STORE)) {
      storeNames.push(LEGACY_BLOBS_STORE);
    }

    const transaction = db.transaction(storeNames, "readwrite");
    const done = waitForTransaction(transaction);

    await requestToPromise(transaction.objectStore(ASSET_REFS_STORE).clear());
    await requestToPromise(transaction.objectStore(BLOBS_BY_HASH_STORE).clear());
    if (db.objectStoreNames.contains(LEGACY_BLOBS_STORE)) {
      await requestToPromise(transaction.objectStore(LEGACY_BLOBS_STORE).clear());
    }

    await done;
    await setMetaBoolean(db, META_KEY_LEGACY_MIGRATED, true);
  });
}

/**
 * Get an Object URL for an asset stored in IndexedDB.
 * Uses an LRU cache so only a bounded number of URLs are alive at once.
 * Returns null if the asset is not in IndexedDB.
 */
export async function getAssetObjectURL(assetId: string): Promise<string | null> {
  const cached = urlCache.get(assetId);
  if (cached) {
    urlCache.delete(assetId);
    urlCache.set(assetId, cached);
    return cached;
  }

  const blob = await getAssetBlob(assetId);
  if (!blob) return null;

  const objectUrl = URL.createObjectURL(blob);
  urlCache.set(assetId, objectUrl);
  evictLRU();
  return objectUrl;
}

/** True when the given object URL is still alive in the in-memory LRU cache. */
export function isCachedAssetObjectURL(assetId: string, objectUrl: string): boolean {
  return urlCache.get(assetId) === objectUrl;
}

/** Revoke all Object URLs (call on unmount / full state reset). */
export function revokeAllObjectURLs(): void {
  for (const url of urlCache.values()) {
    URL.revokeObjectURL(url);
  }
  urlCache.clear();
}

/**
 * Return all asset IDs currently stored in IndexedDB.
 * Useful for orphan cleanup.
 */
export async function listAssetIds(): Promise<string[]> {
  await waitForAllPendingWrites();

  return withReadyDb(async (db) => {
    const transaction = db.transaction(ASSET_REFS_STORE, "readonly");
    const store = transaction.objectStore(ASSET_REFS_STORE);
    const done = waitForTransaction(transaction);
    const keys = await requestToPromise(store.getAllKeys());
    await done;
    return keys.filter((key): key is string => typeof key === "string");
  });
}
