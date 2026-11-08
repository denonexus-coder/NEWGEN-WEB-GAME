/**
 * O package.json raiz é "type":"module" → Node trataria dist-server/*.js como ESM.
 * Marca dist-server como CommonJS (o tsc emite CJS) antes de correr node --test.
 */
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("dist-server", { recursive: true });
writeFileSync("dist-server/package.json", JSON.stringify({ type: "commonjs" }) + "\n");
console.log("[server-build] dist-server/package.json → commonjs");
