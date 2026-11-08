/**
 * Smoke test do worker EMPACOTADO (dist/assets/worker-*.js).
 *
 * Valida o caminho de produção sem browser: o bundle do Vite carrega,
 * responde a listTeams e produz snapshots/stats/events/done de uma
 * partida real (via setInterval simulado).
 *
 * Uso: npm run build && node scripts/smoke-worker.mjs
 */
import { readdirSync } from "node:fs";
import path from "node:path";

const assets = path.resolve("dist/assets");
const file = readdirSync(assets).find((f) => f.startsWith("worker-") && f.endsWith(".js"));
if (!file) {
  console.error("[smoke] bundle do worker não encontrado em dist/assets (corre npm run build)");
  process.exit(1);
}

// ---- shims de browser (o worker usa globalThis.addEventListener/postMessage) ----
const outbox = [];
const listeners = [];
globalThis.addEventListener = (type, cb) => {
  if (type === "message") listeners.push(cb);
};
globalThis.postMessage = (msg) => outbox.push(msg);

await import(path.join(assets, file));

const send = (data) => {
  for (const cb of listeners) cb({ data });
};

// ----1) listTeams ----
send({ kind: "command", cmd: { type: "listTeams" } });
const teamsMsg = outbox.find((m) => m.kind === "teams");
if (!teamsMsg || teamsMsg.teams.length !== 6) {
  console.error("[smoke] listTeams falhou:", JSON.stringify(outbox));
  process.exit(1);
}
console.log(`[smoke] ✓ listTeams: ${teamsMsg.teams.map((t) => t.short).join(" · ")}`);

// ---- 2) init (partida curta, MAX) ----
const before = outbox.length;
send({
  kind: "command",
  cmd: {
    type: "init",
    seed: 42,
    homeId: 5,
    awayId: 3,
    minutes: 1,
    timeScale: 1000,
    physics: true,
  },
});

const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  if (outbox.some((m) => m.kind === "done")) break;
  await new Promise((r) => setTimeout(r, 100));
}

const newMsgs = outbox.slice(before);
const kinds = new Set(newMsgs.map((m) => m.kind));
const ready = newMsgs.find((m) => m.kind === "ready");
const snaps = newMsgs.filter((m) => m.kind === "snapshot");
const stats = newMsgs.find((m) => m.kind === "stats");
const done = newMsgs.find((m) => m.kind === "done");

let failed = false;
const check = (ok, label) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed = true;
};

check(ready && ready.protocol === 1, "ready com protocol v1");
check(snaps.length > 0, `snapshots recebidos (${snaps.length})`);
check(stats !== undefined, "stats recebidos");
check(done !== undefined, "partida termina (done)");
check(kinds.has("events"), "eventos recebidos");

if (snaps.length > 0) {
  const s = snaps[snaps.length - 1].snap;
  check(s.players.length === 22 * 6, "snapshot com22×6 floats");
  check(s.ball.length === 6, "snapshot com6 floats de bola");
  check([...s.players].every(Number.isFinite) && [...s.ball].every(Number.isFinite), "sem NaN");
}
if (done) {
  const d = done.summary;
  console.log(
    `  → resultado: ${d.homeGoals}-${d.awayGoals} · ${d.ticks} ticks · golos: ${d.goalLog.length}`
  );
  check(typeof d.homeGoals === "number" && typeof d.awayGoals === "number", "summary coerente");
}

process.exit(failed ? 1 : 0);
