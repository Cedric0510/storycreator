/**
 * Sauvegarde automatique locale du projet en cours d'edition.
 *
 * Le studio est local-first: sans cette sauvegarde, un F5 ou un crash
 * d'onglet perd tout le travail non exporte en ZIP (l'etat vit en memoire
 * React; seuls les blobs d'assets persistent dans l'assetStore).
 *
 * Modele: IndexedDB dediee, deux entrees.
 * - `latest`: derniere version du travail (ecrite en continu, debounce).
 * - `session-backup`: copie de `latest` prise au demarrage de chaque session,
 *   pour survivre a un ecrasement accidentel de `latest` (ex: l'utilisateur
 *   refuse la restauration puis edite un projet vierge).
 *
 * Le snapshot ne stocke que des donnees serialisables: les blocs (qui portent
 * leur position), jamais les nodes React Flow (dont `data` peut contenir des
 * callbacks). Nodes et edges sont reconstruits a la restauration, comme le
 * fait l'import ZIP.
 */

import { AssetRef, ProjectMeta, StoryBlock } from "@/lib/story";

export interface StudioSnapshot {
  savedAt: string;
  fingerprint: string;
  project: ProjectMeta;
  blocks: StoryBlock[];
  assetRefs: Record<string, AssetRef>;
  openedValidatedChapterIds: string[];
}

const DB_NAME = "author-studio-autosave";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
const LATEST_KEY = "latest";
const SESSION_BACKUP_KEY = "session-backup";

function isIndexedDbAvailable() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
  } finally {
    db.close();
  }
}

export function isStudioSnapshot(value: unknown): value is StudioSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudioSnapshot>;
  return (
    typeof candidate.savedAt === "string" &&
    typeof candidate.fingerprint === "string" &&
    Boolean(candidate.project) &&
    typeof candidate.project === "object" &&
    Boolean((candidate.project as ProjectMeta).info) &&
    Array.isArray(candidate.blocks) &&
    Boolean(candidate.assetRefs) &&
    typeof candidate.assetRefs === "object"
  );
}

/** Ecrit le snapshot courant. Best-effort: toute erreur est avalee. */
export async function saveLatestSnapshot(snapshot: StudioSnapshot): Promise<boolean> {
  if (!isIndexedDbAvailable()) return false;
  try {
    await withStore("readwrite", (store) => store.put(snapshot, LATEST_KEY));
    return true;
  } catch (error) {
    console.error("[studioAutosave] write failed:", error);
    return false;
  }
}

export async function loadLatestSnapshot(): Promise<StudioSnapshot | null> {
  if (!isIndexedDbAvailable()) return null;
  try {
    const raw = await withStore<unknown>("readonly", (store) => store.get(LATEST_KEY));
    return isStudioSnapshot(raw) ? raw : null;
  } catch (error) {
    console.error("[studioAutosave] read failed:", error);
    return null;
  }
}

/**
 * Copie le snapshot fourni vers l'emplacement de secours de session.
 * A appeler une fois au demarrage, avant que `latest` ne soit reecrit.
 */
export async function promoteToSessionBackup(snapshot: StudioSnapshot): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  try {
    await withStore("readwrite", (store) => store.put(snapshot, SESSION_BACKUP_KEY));
  } catch (error) {
    console.error("[studioAutosave] session backup failed:", error);
  }
}

/** Secours de session (non expose dans l'UI pour l'instant; recuperable a la main). */
export async function loadSessionBackupSnapshot(): Promise<StudioSnapshot | null> {
  if (!isIndexedDbAvailable()) return null;
  try {
    const raw = await withStore<unknown>("readonly", (store) => store.get(SESSION_BACKUP_KEY));
    return isStudioSnapshot(raw) ? raw : null;
  } catch {
    return null;
  }
}
