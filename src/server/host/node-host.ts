/**
 * Host Node — corre uma partida completa no terminal (testes manuais/CI).
 *
 *   node dist-server/server/host/node-host.js [--home 5] [--away 3]
 *        [--minutes 90] [--seed 42] [--dt 0.05] [--fast] [--no-physics]
 *
 * `--fast` usa dt=0.5 (modo torneio, ~50× mais rápido).
 */
/// <reference types="node" />
import { GameServer } from "../server-core";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : def;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const seed = Number(arg("seed", "42"));
const homeId = Number(arg("home", "5"));
const awayId = Number(arg("away", "3"));
const minutes = Number(arg("minutes", "90"));
const dt = Number(arg("dt", flag("fast") ? "0.5" : "0.05"));
const physics = !flag("no-physics");

const srv = new GameServer({ seed, homeId, awayId, minutes, dt, physics });
srv.start();
const [home, away] = srv.getTeams();

const pct = (a: number, b: number): string =>
  a + b > 0 ? `${Math.round((100 * a) / (a + b))}%` : "-";

console.log("=".repeat(72));
console.log(
  `  ⚽  ${home.name}  vs  ${away.name}   ·  seed ${seed} · ${minutes}' · ` +
    `dt ${dt} · física ${physics ? "ON" : "OFF"}`
);
console.log("=".repeat(72));

const wall0 = Date.now();
let r = srv.step(200_000);
let guard = 0;
while (!r.done && guard++ < 10_000) {
  r = srv.step(200_000);
}
const wallMs = Date.now() - wall0;

const res = r.result;
if (!res) {
  console.error("partida não terminou");
  process.exit(1);
}

console.log(`\n🏁 RESULTADO FINAL:  ${res.homeShort} ${res.homeGoals} - ${res.awayGoals} ${res.awayShort}`);
console.log(`   ${res.ticks} ticks · ${wallMs}ms wall · determinístico (seed ${seed})`);

if (res.goalLog.length > 0) {
  console.log("\n📌 Golos:");
  for (const g of res.goalLog) console.log(`   ${g}`);
}

const stats = r.stats;
if (stats) {
  const h = stats.home;
  const a = stats.away;
  console.log("\n📊 Estatísticas (casa | fora):");
  const row = (label: string, x: number | string, y: number | string, suffix = "") =>
    console.log(`   ${label.padEnd(18)} ${String(x).padStart(6)} | ${String(y).padStart(6)}${suffix}`);
  row("Posse", pct(h.possessionTicks, a.possessionTicks), pct(a.possessionTicks, h.possessionTicks));
  row("Passes (compl.)", `${h.passesCompleted}/${h.passesAttempted}`, `${a.passesCompleted}/${a.passesAttempted}`);
  row("Remates", h.shots, a.shots);
  row("  à baliza", h.shotsOnTarget, a.shotsOnTarget);
  row("  bloqueados", h.shotsBlocked, a.shotsBlocked);
  row("Defesas (GR)", h.saves, a.saves);
  row("Dribles ganhos", h.dribblesWon, a.dribblesWon);
  row("Desarmes", h.tacklesWon, a.tacklesWon);
  row("Interceptações", h.interceptions, a.interceptions);
  row("Skill moves", h.skillMoves, a.skillMoves);
}

// sanity: identidade estatística (shotsOnTarget = golos + defesas do adversário)
if (stats) {
  const okH = stats.home.shotsOnTarget === stats.home.goals + stats.away.saves;
  const okA = stats.away.shotsOnTarget === stats.away.goals + stats.home.saves;
  if (!okH || !okA) {
    console.error("\n❌ integridade estatística falhou");
    process.exit(1);
  }
  console.log("\n✅ identidade estatística ok");
}

srv.dispose();
