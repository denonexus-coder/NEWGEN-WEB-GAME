/**
 * Teste 1 — Partida completa (90', física ON, dt 0.5) tem de terminar
 * com integridade: identidade estatística, eventos de período, snapshot válido.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { GameServer } from "../server-core";

test("partida completa de 90' termina com integridade", () => {
  const srv = new GameServer({
    seed: 42,
    homeId: 5,
    awayId: 3,
    minutes: 90,
    dt: 0.5,
    physics: true,
  });
  srv.start();

  let r = srv.step(5000);
  let guard = 0;
  const allEvents: typeof r.events = [];
  while (guard++ < 1000) {
    allEvents.push(...r.events);
    if (r.done) break;
    r = srv.step(5000);
  }

  assert.ok(r.done, "a partida termina");
  const res = r.result;
  assert.ok(res, "resultado disponível");
  assert.equal(res.ticks, 10800, "5400s / dt 0.5 = 10800 ticks");

  // placar coerente com o log de golos
  assert.ok(res.homeGoals >= 0 && res.awayGoals >= 0);
  assert.equal(
    res.goalLog.length,
    res.homeGoals + res.awayGoals,
    "cada golo está no goalLog"
  );

  // identidade estatística: remates à baliza = golos + defesas do adversário
  assert.equal(res.home.shotsOnTarget, res.home.goals + res.away.saves);
  assert.equal(res.away.shotsOnTarget, res.away.goals + res.home.saves);
  assert.ok(res.home.passesAttempted > 0, "há passes");
  assert.ok(res.home.shots > 0 || res.away.shots > 0, "há remates");

  // snapshot final válido
  const snap = r.snapshot;
  assert.ok(snap, "há snapshot final");
  assert.equal(snap.players.length, 22 * 6);
  assert.equal(snap.ball.length, 6);
  assert.equal(snap.scoreHome, res.homeGoals);
  assert.equal(snap.scoreAway, res.awayGoals);
  for (let i = 0; i < snap.players.length; i++) {
    assert.ok(Number.isFinite(snap.players[i]), `players[${i}] finito`);
  }
  for (let i = 0; i < snap.ball.length; i++) {
    assert.ok(Number.isFinite(snap.ball[i]), `ball[${i}] finito`);
  }
  // jogadores dentro do campo
  for (let i = 0; i < 22; i++) {
    const x = snap.players[i * 6];
    const y = snap.players[i * 6 + 1];
    assert.ok(x >= 0 && x <= 100, `jogador ${i} x em campo (${x})`);
    assert.ok(y >= 0 && y <= 65, `jogador ${i} y em campo (${y})`);
  }

  // eventos de período presentes (acumulados ao longo da partida)
  const types = allEvents.map((e) => e.type);
  assert.ok(types.includes("fulltime"), "evento fulltime emitido");
  assert.ok(types.includes("halftime"), "evento halftime emitido");
  assert.ok(types.includes("kickoff"), "há kickoff");
  // golos → eventos estruturados
  const goals = allEvents.filter((e) => e.type === "goal");
  assert.equal(goals.length, res.homeGoals + res.awayGoals, "evento por golo");
  for (const e of allEvents) {
    const rt = JSON.parse(JSON.stringify(e));
    assert.deepStrictEqual(rt, e, "eventos serializáveis (JSON round-trip)");
  }

  // stats finais coerentes
  assert.ok(r.stats, "stats finais");
  assert.equal(r.stats.home.goals, res.homeGoals);

  srv.dispose();
});

test("integridade mantém-se com física desligada (modo benchmarks)", () => {
  const srv = new GameServer({
    seed: 7,
    homeId: 2,
    awayId: 5,
    minutes: 30,
    dt: 0.5,
    physics: false,
  });
  srv.start();
  let r = srv.step(5000);
  let guard = 0;
  while (!r.done && guard++ < 500) r = srv.step(5000);
  assert.ok(r.done);
  const res = r.result!;
  assert.equal(res.home.shotsOnTarget, res.home.goals + res.away.saves);
  assert.equal(res.away.shotsOnTarget, res.away.goals + res.home.saves);
  assert.equal(res.ticks, 3600); // 1800s / 0.5
  srv.dispose();
});
