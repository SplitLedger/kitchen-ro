import { catalogNameClash } from "@/db/catalog-edit";
import type { KitchenDatabase } from "@/db/client";
import { invalidMessage, parseCatalogName } from "@/domain/catalog/edit";

export async function nameTakenMessage(
  db: KitchenDatabase,
  kind: "ingredient" | "recipe" | "kit",
  name: string,
  exceptId?: number,
): Promise<string | undefined> {
  if (invalidMessage(() => parseCatalogName(name))) {
    return undefined;
  }
  const clash = await catalogNameClash(db, kind, name, exceptId);
  return clash ? `"${clash}" is already used.` : undefined;
}
