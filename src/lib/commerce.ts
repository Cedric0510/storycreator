import { Chapter, CommerceCatalog, CommerceProduct, createId } from "@/lib/story";

export function normalizeCommerceCatalog(
  value: unknown,
  chapters: Chapter[],
): CommerceCatalog {
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));
  const source = value && typeof value === "object"
    ? (value as { products?: unknown }).products
    : [];
  if (!Array.isArray(source)) return { products: [] };
  const usedIds = new Set<string>();
  const usedStoreIds = new Set<string>();
  const products: CommerceProduct[] = [];
  for (const entry of source) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<CommerceProduct>;
    const googlePlayProductId = typeof candidate.googlePlayProductId === "string"
      ? candidate.googlePlayProductId.trim()
      : "";
    if (!googlePlayProductId || usedStoreIds.has(googlePlayProductId)) continue;
    const id = typeof candidate.id === "string" && candidate.id && !usedIds.has(candidate.id)
      ? candidate.id
      : createId("product");
    usedIds.add(id);
    usedStoreIds.add(googlePlayProductId);
    products.push({
      id,
      name: typeof candidate.name === "string" && candidate.name.trim()
        ? candidate.name.trim()
        : googlePlayProductId,
      googlePlayProductId,
      chapterIds: Array.isArray(candidate.chapterIds)
        ? [...new Set(candidate.chapterIds.filter((chapterId): chapterId is string =>
            typeof chapterId === "string" && chapterIds.has(chapterId),
          ))]
        : [],
    });
  }
  return { products };
}

export function chapterIsPaid(catalog: CommerceCatalog, chapterId: string): boolean {
  return catalog.products.some((product) => product.chapterIds.includes(chapterId));
}
