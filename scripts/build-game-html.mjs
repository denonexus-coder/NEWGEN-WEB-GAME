/**
 * Regenera o bloco <script> do jogo NEWGEN·NEWEGOISTS a partir de js/*.js.
 *
 * Histórico: o commit 8bacb9a ("HTML self-contained") inlineou os ficheiros
 * à mão — e:
 *   • apagou a tag do three.js (tela preta: THREE por definir);
 *   • comeu um "}" no bloco do 70-3d e manguiu a linha others= do 90-ui;
 *   • os ficheiros js/ têm uma colisão histórica (const bar da baliza vs
 *     function bar da UI) que só aparece quando tudo corre no mesmo scope.
 *
 * Este script é a fonte da verdade: o html é GERADO a partir dos ficheiros
 * (que são os mesmos que o utilizador jogava em ≤1.3.0), com validação de
 * sintaxe do conjunto — nunca mais há corrupção silenciosa.
 *
 * Uso: node scripts/build-game-html.mjs   (ou npm run build:game)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public/games/newgen-egoists");
const htmlPath = path.join(dir, "index.html");
const jsDir = path.join(dir, "js");

const files = readdirSync(jsDir).filter((f) => f.endsWith(".js")).sort();
if (files.length < 10) {
  console.error(`[build-game] esperados 10 ficheiros em js/, encontrados: ${files.length}`);
  process.exit(1);
}

const js = files.map((f) => readFileSync(path.join(jsDir, f), "utf8")).join("\n");

// um </script> no código partiria o html no sítio errado
if (js.includes("</script")) {
  console.error("[build-game] ERRO: </script> encontrado no conteúdo de js/");
  process.exit(1);
}

// valida o conjunto COMO UM SÓ script (é assim que o browser o executa) —
// apanha colisões de identificadores de topo entre ficheiros (ex.: bar)
try {
  new vm.Script(js, { filename: "game-bundle.js" });
} catch (e) {
  console.error(`[build-game] ERRO de sintaxe no conjunto dos ficheiros js/: ${e.message}`);
  process.exit(1);
}

let html = readFileSync(htmlPath, "utf8");
const threeTag = '<script src="../../vendor/three.min.js"></script>';
if (!html.includes(threeTag)) {
  console.error("[build-game] ERRO: tag do three.js não encontrada no html");
  process.exit(1);
}

const start = html.indexOf("<script>", html.indexOf(threeTag) + threeTag.length);
const end = html.lastIndexOf("</script>");
if (start < 0 || end < 0 || end < start) {
  console.error("[build-game] ERRO: limites do bloco inline não encontrados");
  process.exit(1);
}

const out = html.slice(0, start) + "<script>\n" + js + "\n</script>" + html.slice(end + "</script>".length);
writeFileSync(htmlPath, out);

const inlineCount = (out.match(/<script/g) || []).length;
if (inlineCount !== 2) {
  console.error(`[build-game] ERRO: esperados 2 <script> (three + bundle), encontrados ${inlineCount}`);
  process.exit(1);
}
console.log(`[build-game] ok — ${files.length} ficheiros inlineados em index.html (${out.length} bytes)`);
