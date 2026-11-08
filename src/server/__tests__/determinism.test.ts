/**
 * Teste 2 — Determinismo: mesma seed → jogo idêntico bit a bit.
 * E o RNG global é reposto ao fazer dispose().
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { GameServer } from "../server-core";

interface RunOutcome {
  homeGoals: number;
  awayGoals: number;
  ticks: number;
  goalLog: string[];
  statsJson: string;
  players: number[];
  ball: number[];
}

function run(seed: number): RunOutcome {
  const srv = new GameServer({
    seed,
    homeId: 2,
    awayId: 5,
    minutes: 5,
    dt: 0.5,
    physics: true,
  });
  srv.start();
  let r = srv.step(2000);
  let guard = 0;
  while (!r.done && guard++ < 200) r = srv.step(2000);
  assert.ok(r.done, "partida de teste termina");
  const res = r.result!;
  const snap = r.snapshot!;
  const out: RunOutcome = {
    homeGoals: res.homeGoals,
    awayGoals: res.awayGoals,
    ticks: res.ticks,
    goalLog: res.goalLog,
    statsJson: JSON.stringify(r.stats),
    players: Array.from(snap.players),
    ball: Array.from(snap.ball),
  };
  srv.dispose();
  return out;
}

test("mesma seed → resultados idênticos (bit a bit)", () => {
  const a = run(1234);
  const b = run(1234);
  assert.deepStrictEqual(a, b);
});

test("seed diferente → jogo diferente", () => {
  const a = run(1);
  const c = run(2);
  // atributos/squads diferentes → o fluxo diverge (estatísticas ou log)
  assert.notStrictEqual(
    JSON.stringify([a.homeGoals, a.awayGoals, a.goalLog, a.statsJson]),
    JSON.stringify([c.homeGoals, c.awayGoals, c.goalLog, c.statsJson])
  );
});

test("dispose repõe o Math.random global", () => {
  const original = Math.random;
  const srv = new GameServer({ seed: 9, homeId: 1, awayId: 6, minutes: 1, dt: 0.5 });
  srv.start();
  assert.notStrictEqual(Math.random, original, "RNG stubado durante o jogo");
  let r = srv.step(10);
  while (!r.done) r = srv.step(1000);
  srv.dispose();
  assert.strictEqual(Math.random, original, "RNG restaurado após dispose");
});
