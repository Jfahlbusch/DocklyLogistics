import "../lib/schemas/article";
import "../lib/schemas/supplier";
import "../lib/schemas/tenant-channel";
import "../lib/schemas/storage-location";
import { buildOpenApi } from "../lib/api/openapi";

const doc = buildOpenApi();
const paths = Object.keys(doc.paths ?? {}).sort();
console.log("Total paths:", paths.length);
console.log("Paths:");
for (const p of paths) {
  const methods = Object.keys(doc.paths![p] as Record<string, unknown>).filter((k) =>
    ["get", "post", "put", "patch", "delete", "options", "head"].includes(k),
  );
  console.log(`  ${p} -> [${methods.join(", ").toUpperCase()}]`);
}
