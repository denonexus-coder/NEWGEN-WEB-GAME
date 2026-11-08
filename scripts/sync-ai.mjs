#!/usr/bin/env node
/**
 * Sincroniza o laboratório AI-engine → servidor do launcher.
 *
 * Uso:
 *   node scripts/sync-ai.mjs --from ../AI-engine
 *
 * O que copia:
 *   AI-engine/src/core                  → src/server/ai/core
 *   AI-engine/src/01..12 engines        → src/server/ai/<mesmo-nome>
 *   AI-engine/src/benchmark/tournament/{simulation,teams}.ts
 *                                       → src/server/sim/  (imports ../../ → ../ai/)
 *
 * Escreve src/server/ai/AI-VERSION com o hash SHA-256 dos ficheiros copiados
 * (AI-engine não é um repo git — o hash é a proveniência).
 *
 * Regra: src/server/** nunca importa DOM/three — o código copiado é puro.
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// ---- args ----
const argFrom = process.argv.indexOf("--from");
const srcRoot = path.resolve(root, argFrom >= 0 ? process.argv[argFrom + 1] : "../AI-engine");
const destRoot = path.join(root, "src", "server");

if (!existsSync(path.join(srcRoot, "src", "core"))) {
  console.error(`[sync-ai] origem inválida: ${srcRoot} (esperado AI-engine com src/core)`);
  process.exit(1);
}

// ---- pastas de motores a copiar (01..12) ----
const engineDirs = readdirSync(path.join(srcRoot, "src"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d\d_/.test(d.name))
  .map((d) => d.name)
  .sort();

// ---- limpa destinos geridos ----
for (const sub of ["ai", "sim"]) {
  const p = path.join(destRoot, sub);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

// ---- copia core + motores (estrutura preservada → imports relativos intactos) ----
const copied = [];
function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const f = path.join(from, entry.name);
    const t = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(f, t);
    else if (entry.name.endsWith(".ts")) {
      cpSync(f, t);
      copied.push(t);
    }
  }
}
copyDir(path.join(srcRoot, "src", "core"), path.join(destRoot, "ai", "core"));
for (const d of engineDirs) {
  copyDir(path.join(srcRoot, "src", d), path.join(destRoot, "ai", d));
}

// ---- copia simulation + teams para src/server/sim/ com reescrita de imports ----
// Nos ficheiros originais (src/benchmark/tournament/) "../../X" aponta à raiz src/.
// No destino (src/server/sim/) a raiz da IA é "../ai/".
mkdirSync(path.join(destRoot, "sim"), { recursive: true });
for (const name of ["simulation.ts", "teams.ts"]) {
  const from = path.join(srcRoot, "src", "benchmark", "tournament", name);
  if (!existsSync(from)) {
    console.error(`[sync-ai] falta ${from}`);
    process.exit(1);
  }
  const code = readFileSync(from, "utf8");
  const rewritten = code.replaceAll('from "../../', 'from "../ai/');
  if (rewritten === code && code.includes('from "../../')) {
    console.error(`[sync-ai] reescrita falhou em ${name}`);
    process.exit(1);
  }
  const to = path.join(destRoot, "sim", name);
  writeFileSync(to, rewritten);
  copied.push(to);
}

// ---- verifica que nenhum import escapa de src/server (resolve relativamente ao ficheiro) ----
for (const file of copied) {
  const code = readFileSync(file, "utf8");
  const dir = path.posix.dirname(path.relative(destRoot, file).split(path.sep).join("/"));
  for (const m of code.matchAll(/from ["']([^"']+)["']/g)) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue; // só relativos
    const resolved = path.posix.normalize(path.posix.join(dir, spec));
    if (resolved.startsWith("..")) {
      console.error(`[sync-ai] import escapou em ${path.relative(root, file)}: ${spec} → ${resolved}`);
      process.exit(1);
    }
  }
}

// ---- versão (hash de todos os ficheiros copiados, ordenados) ----
const hash = createHash("sha256");
for (const file of [...copied].sort()) {
  hash.update(path.relative(destRoot, file));
  hash.update(readFileSync(file));
}
const digest = hash.digest("hex").slice(0, 16);
const srcCommit = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: srcRoot, stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim();
  } catch {
    return "no-git";
  }
})();

const version = [
  `source: AI-engine (${srcCommit})`,
  `synced: ${new Date().toISOString()}`,
  `hash: sha256:${digest}`,
  `files: ${copied.length}`,
  `engines: ${engineDirs.join(", ")}`,
  "",
].join("\n");
writeFileSync(path.join(destRoot, "ai", "AI-VERSION"), version);

const bytes = copied.reduce((s, f) => s + statSync(f).size, 0);
console.log(`[sync-ai] ✓ ${copied.length} ficheiros (${(bytes / 1024).toFixed(0)} KB) → src/server/{ai,sim}`);
console.log(`[sync-ai] ✓ hash sha256:${digest} · motores: ${engineDirs.length}`);
