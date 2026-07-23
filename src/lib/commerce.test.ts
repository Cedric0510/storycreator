import { describe, expect, it } from "vitest";
import { normalizeCommerceCatalog } from "./commerce";

const chapters = [
  { id: "chapter-1", name: "Chapitre 1", collapsed: false, validated: true },
  { id: "chapter-2", name: "Chapitre 2", collapsed: false, validated: true },
];

describe("commerce catalog", () => {
  it("keeps valid unique products and existing chapters", () => {
    const catalog = normalizeCommerceCatalog({
      products: [{
        id: "pack-1",
        name: "Pack",
        googlePlayProductId: "cadarium.pack.1",
        chapterIds: ["chapter-1", "missing", "chapter-2", "chapter-1"],
      }],
    }, chapters);

    expect(catalog.products).toEqual([{
      id: "pack-1",
      name: "Pack",
      googlePlayProductId: "cadarium.pack.1",
      chapterIds: ["chapter-1", "chapter-2"],
    }]);
  });

  it("removes duplicate Google Play identifiers", () => {
    const catalog = normalizeCommerceCatalog({
      products: [
        { id: "one", name: "One", googlePlayProductId: "same.id", chapterIds: [] },
        { id: "two", name: "Two", googlePlayProductId: "same.id", chapterIds: [] },
      ],
    }, chapters);

    expect(catalog.products).toHaveLength(1);
  });
});
