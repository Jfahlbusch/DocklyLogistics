import { describe, expect, it } from "vitest";
import { ArticleCreateSchema, ArticleUpdateSchema } from "@/lib/schemas/article";

// Regression: Unter Zod 4 wendet `.partial()` die Defaults des Ausgangsschemas an — ein PATCH {name}
// setzte dadurch minStock auf 0 und barcodeSource auf SKU zurück.
describe("ArticleUpdateSchema", () => {
  it("setzt bei Teil-Updates keine Defaults", () => {
    expect(ArticleUpdateSchema.parse({ name: "Mehl" })).toEqual({ name: "Mehl" });
  });

  it("ArticleCreateSchema behält die Defaults", () => {
    const parsed = ArticleCreateSchema.parse({ sku: "A1", name: "Mehl", baseUnit: "KG", orderUnit: "KG", packFactor: 1 });
    expect(parsed.minStock).toBe(0);
    expect(parsed.barcodeSource).toBe("SKU");
  });
});
