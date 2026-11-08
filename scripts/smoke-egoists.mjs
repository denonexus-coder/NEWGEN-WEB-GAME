/**
 * Smoke test do jogo NEWGEN · NEWEGOISTS (o bundle em dist/).
 *
 * Propósito: provar que o bug da "tela preta" está corrigido —
 * a causa era o refactor "tudo inline" (8bacb9a) ter APAGADO a tag
 * `<script src="../../vendor/three.min.js">`, deixando `THREE` por
 * definir → ReferenceError no arranque → ecrã preto.
 *
 * O que valida:
 *  1. o html referenciava o three por um caminho que EXISTE no dist;
 *  2. o jogo arranca em DOM real (jsdom): THREE definido, boot() completo
 *     (#load oculto), menu renderizado (#scr com conteúdo);
 *  3. o loop rAF + uiTick correm (frame.ui avança);
 *  4. clicar (equipa → Jogar) não gera erros não capturados.
 *
 * O renderer WebGL é substituído por um stub (jsdom não tem WebGL) —
 * tudo o resto é o three.js REAL e o código REAL do jogo.
 *
 * Uso: npm run build && npm run smoke:game
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "dist/games/newgen-egoists/index.html");

if (!existsSync(htmlPath)) {
  console.error("[smoke-game] dist/games/newgen-egoists/index.html não existe (corre npm run build)");
  process.exit(1);
}

let html = readFileSync(htmlPath, "utf8");

/* derivação: o inline do html tem de ser cópia byte-a-byte dos ficheiros js/
   (o build:game os regenera; isto apanha qualquer edição manual solta) */
const jsDirSrc = path.join(root, "public/games/newgen-egoists/js");
const results = [];
const check = (ok, label) => {
  results.push([ok, label]);
  console.log(`${ok ? "✓" : "✗"} ${label}`);
};
const drift = readdirSync(jsDirSrc)
  .filter((f) => f.endsWith(".js"))
  .sort()
  .filter((f) => !html.includes(readFileSync(path.join(jsDirSrc, f), "utf8")));
check(drift.length === 0, `inline do html ≡ js/*.js (sem derivação)${drift.length ? " → falta: " + drift.join(", ") : ""}`);

/* ---------------------------------------------------------------- 1) three */
const srcMatch = html.match(/<script src="([^"]*three[^"]*)"><\/script>/);
check(!!srcMatch, "html referencia o three por <script src>");
if (srcMatch) {
  const threePath = path.resolve(path.dirname(htmlPath), srcMatch[1]);
  check(existsSync(threePath), `three local existe no dist (${srcMatch[1]})`);
  const threeSource = readFileSync(threePath, "utf8");
  check(threeSource.includes("WebGLRenderer"), "three.min.js é o three.js a sério");

  // injeta o three + stub do renderer inline (jsdom não resolve src externo)
  const stub = `
    ;(function () {
      class WebGLRendererStub {
        constructor(params) {
          this.domElement = (params && params.canvas) || null;
          this.shadowMap = { enabled: false, type: 0, needsUpdate: false, autoUpdate: true };
          this.info = { render: { calls: 0, triangles: 0, points: 0, lines: 0 }, memory: { geometries: 0, textures: 0 } };
          this.capabilities = { isWebGL2: false, precision: "highp", maxTextures: 16, maxTextureSize: 4096, maxAnisotropy: 1, maxAttributes: 16, maxVertexUniforms: 1024, maxVaryings: 16, maxFragmentUniforms: 1024, maxVertexTextures: 16, maxCubemapSize: 4096, floatFragmentTextures: true, vertexTextures: true, maxSamples: 4 };
          this.outputEncoding = 3001; this.autoClear = true; this.sortObjects = true;
          this.localClippingEnabled = false;
        }
        setPixelRatio() {} setSize() {} setViewport() {} setScissor() {} setScissorTest() {}
        setClearColor() {} getPixelRatio() { return 1; }
        getSize(t) { if (t) { t.width = 0; t.height = 0; } return t; }
        getDrawingBufferSize(t) { return this.getSize(t); }
        getContext() { return null; } getContextAttributes() { return null; }
        render() {} clear() {} dispose() {} forceContextLoss() {}
      }
      THREE.WebGLRenderer = WebGLRendererStub;
    })();`;
  // escapa qualquer </script> dentro dos ficheiros (não deveria haver)
  const safeThree = threeSource.replace(/<\/script>/g, "<\\/script>");
  html = html.replace(srcMatch[0], `<script>${safeThree}</script><script>${stub}</script>`);
}

/* ------------------------------------------------------------- 2) jsdom run */
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  const msg = String(e && e.message);
  // limitações conhecidas do jsdom (não são bugs do jogo)
  if (msg.includes("Not implemented")) return;
  errors.push(`jsdomError: ${msg}${e && e.detail ? " :: " + e.detail : ""}`);
});
// o jogo só usa console.error nos catches de [step]/[draw]/[hud]/[render]
// — qualquer chamada é uma falha real de runtime
vc.on("error", (...args) => errors.push(`console.error: ${args.map(String).join(" ")}`));

const dom = new JSDOM(html, {
  url: "https://newgen.local/games/newgen-egoists/index.html",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    // canvas2d fake (texturas procedurais do jogo)
    const make2d = (canvas) => {
      const grad = { addColorStop() {} };
      const base = {
        canvas,
        measureText: () => ({ width: 12 }),
        createLinearGradient: () => grad,
        createRadialGradient: () => grad,
        createPattern: () => null,
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h }),
        putImageData() {},
      };
      return new Proxy(base, {
        get(t, p) {
          if (typeof p === "symbol") return t[p];
          if (p in t) return t[p];
          return () => undefined;
        },
        set(t, p, v) {
          t[p] = v;
          return true;
        },
      });
    };
    window.HTMLCanvasElement.prototype.getContext = function (type) {
      return type === "2d" ? make2d(this) : null;
    };
    window.addEventListener("error", (e) => {
      errors.push(`window.error: ${e.message || (e.error && e.error.message) || "?"}`);
    });
  },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const doc = dom.window.document;

await sleep(1400); // rAF + uiTick (limiar de1s)

/* ----------------------------------------------------------- 3) asserções */
const THREE = dom.window.THREE;
check(!!THREE && typeof THREE === "object" && !!THREE.REVISION, `THREE definido (r${THREE && THREE.REVISION})`);

const load = doc.getElementById("load");
check(!!load && load.style.display === "none", "boot() completo (#load oculto)");

const scr = doc.getElementById("scr");
const scrText = scr ? scr.textContent.replace(/\s+/g, " ").trim() : "";
check(!!scr && scrText.length > 20, `menu renderizado (#scr com conteúdo: "${scrText.slice(0, 60)}…")`);

check(typeof dom.window.frame === "function" && (dom.window.frame.ui || 0) > 0, `loop rAF vivo (frame.ui=${dom.window.frame && dom.window.frame.ui})`);

/* ------------------------------------------------- 4) interação: equipa→jogar→partida */
const errorsBefore = errors.length;
if (scr) {
  const teamBtn = scr.querySelector("button");
  if (teamBtn) {
    teamBtn.click();
    await sleep(400);
    const playBtn = doc.querySelector('[data-act="play"]');
    if (playBtn) playBtn.click();
    await sleep(700);
    check(true, "cliques (equipa → Jogar) executados");
  } else {
    check(false, "há botões no menu para interagir");
  }
}

/* o calendário é em tempo real — se o kickoff da minha partida ainda não
   abriu, força a janela e entra (é o caminho "ao entrar na partida" que os
   commits 787b12e/2603bb2 tentavam desenharar) */
const evalIn = (code) => {
  try {
    return dom.window.eval(code);
  } catch (e) {
    errors.push(`eval(${code.slice(0, 40)}…): ${e.message}`);
    return undefined;
  }
};
const inMatch = () => evalIn("typeof NG!=='undefined'&&NG.view==='match'") === true;
if (!inMatch()) {
  evalIn("(()=>{const i=W.fx.findIndex(f=>fMine(f));if(i>=0){W.fx[i].kick=Date.now()-60000;go(i,1)}})()");
  await sleep(700);
}
check(inMatch(), `partida arranca (NG.view=${evalIn("typeof NG!=='undefined'?NG.view:'?'")})`);

// deixa o loop completo correr: simulação (step) + draw + hud + render
await sleep(1600);
check(evalIn("typeof S!=='undefined'&&S!==null") === true, "estado da partida criado (S ativo)");

check(errors.length === errorsBefore, "sem erros não capturados após interação/entrada na partida");
check(errors.length === 0, `sem erros não capturados no total${errors.length ? " → " + errors.join(" | ") : ""}`);

const failed = results.filter(([ok]) => !ok).length;
console.log(`\n[smoke-game] ${results.length - failed}/${results.length} verificações passaram`);
if (failed > 0 || errors.length > 0) process.exit(1);
process.exit(0);
