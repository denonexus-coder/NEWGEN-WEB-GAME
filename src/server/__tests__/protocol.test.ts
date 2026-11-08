/**
 * Teste 4 — Protocolo: constantes, forma dos snapshots, handshake de equipas
 * e cadência das stats. É o contrato que o client consome (não mudar à mão).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BALL_FLOATS,
  PLAYER_COUNT,
  PLAYER_STRIDE,
  PROTOCOL_VERSION,
  LOGIC_DT,
  type GameEvent,
} from "../../shared/protocol";
import { GameServer } from "../server-core";

test("constantes do protocolo", () => {
  assert.equal(PLAYER_STRIDE, 6);
  assert.equal(PLAYER_COUNT, 22);
  assert.equal(BALL_FLOATS, 6);
  assert.equal(PROTOCOL_VERSION, 1);
  assert.ok(LOGIC_DT > 0 && LOGIC_DT <= 0.1, "tick fixo razoável");
});

test("handshake: info das duas equipas completa", () => {
  const srv = new GameServer({ seed: 1, homeId: 4, awayId: 6, minutes: 1 });
  srv.start();
  const teams = srv.getTeams();
  assert.equal(teams.length, 2);
  assert.equal(teams[0].id, 4);
  assert.equal(teams[1].id, 6);
  for (const t of teams) {
    assert.ok(t.name.length > 0);
    assert.ok(t.short.length > 0);
    assert.ok(t.style.length > 0);
    assert.ok(t.formation.length > 0);
    assert.equal(t.colors.length, 4, "paleta [equipa, secundária, GR, destaque]");
    for (const c of t.colors) assert.match(c, /^#[0-9a-fA-F]{6}$/);
  }
  srv.dispose();
});

test("snapshots: strides corretos, finite, exatamente um com bola", () => {
  const srv = new GameServer({ seed: 42, homeId: 3, awayId: 5, minutes: 1, dt: 0.5 });
  srv.start();

  let r = srv.step(1);
  let snaps = 0;
  let prevSeq = 0;
  let guard = 0;
  //1' a dt0.5 =120 ticks
  while (!r.done && guard++ < 300) {
    if (r.snapshot) {
      snaps++;
      const s = r.snapshot;
      assert.ok(s.seq > prevSeq, "seq monotónico");
      prevSeq = s.seq;
      assert.equal(s.players.length, PLAYER_COUNT * PLAYER_STRIDE);
      assert.equal(s.ball.length, BALL_FLOATS);
      assert.ok(Number.isFinite(s.gameTime) && s.gameTime >= 0);
      assert.ok(s.scoreHome >= 0 && s.scoreAway >= 0);
      assert.ok(s.possession === 1 || s.possession === 2);
      assert.ok(typeof s.ballInFlight === "boolean");
      // exatamente um jogador com a bola (a bola nunca fica "sem dono")
      let withBall = 0;
      for (let i = 0; i < PLAYER_COUNT; i++) {
        if (s.players[i * PLAYER_STRIDE + 5] === 1) withBall++;
        for (let k = 0; k < PLAYER_STRIDE; k++) {
          assert.ok(Number.isFinite(s.players[i * PLAYER_STRIDE + k]));
        }
      }
      assert.equal(withBall, 1, "exatamente um hasBall");
    }
    if (r.stats) {
      // stats a cada ~1s de jogo → em dt0.5, a cada2 ticks
      assert.ok(r.stats.home.passesAttempted >= 0);
      assert.ok(r.stats.away.shots >= 0);
    }
    r = srv.step(1);
  }
  assert.ok(r.done, "partida de1' termina");
  assert.ok(snaps >= 2, "há snapshots");
  srv.dispose();
});

test("events: JSON round-trip e campos do contrato", () => {
  const srv = new GameServer({ seed: 42, homeId: 5, awayId: 3, minutes: 90, dt: 0.5 });
  srv.start();
  let r = srv.step(5000);
  const all: GameEvent[] = [];
  let guard = 0;
  while (guard++ < 1000) {
    all.push(...r.events);
    if (r.done) break;
    r = srv.step(5000);
  }
  assert.ok(r.done);
  assert.ok(all.length > 0, "houve eventos");

  const allowed = new Set(["goal", "shot", "save", "kickoff", "halftime", "fulltime"]);
  for (const e of all) {
    assert.ok(allowed.has(e.type), `tipo válido: ${e.type}`);
    assert.ok(Number.isFinite(e.t) && e.t >= 0);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(e)), e, "serialização estável");
    if (e.type === "goal") {
      assert.ok(e.team === 1 || e.team === 2);
      assert.ok(typeof e.player === "string" && e.player.length > 0);
      assert.ok(typeof e.scoreHome === "number");
    }
  }
  // tipos de evento de período presentes
  const types = all.map((e) => e.type);
  assert.ok(types.includes("halftime"));
  assert.ok(types.includes("fulltime"));
  srv.dispose();
});
