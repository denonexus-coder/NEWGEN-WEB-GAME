/**
 * Teste 3 — Física da bola: parábola, quique, chegada ao alvo, fora de
 * campo, NaN impossível e separação de jogadores.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BallPhysics } from "../physics/ball-physics";
import { createBallState } from "../ai/core/types/ball";
import { vec3 } from "../ai/core/math/vector3d";
import type { PlayerState } from "../ai/core/types/player";

const DT = 0.05;

function assertFiniteBall(ball: ReturnType<typeof createBallState>): void {
  for (const v of [
    ball.position.x,
    ball.position.y,
    ball.position.z,
    ball.velocity.x,
    ball.velocity.y,
    ball.velocity.z,
  ]) {
    assert.ok(Number.isFinite(v), "sem NaN/Inf na bola");
  }
  assert.ok(ball.position.z >= 0, "bola nunca abaixo do chão");
}

test("remate com loft: sobe, desce e termina sem NaN", () => {
  const phys = new BallPhysics();
  const ball = createBallState();
  ball.position = vec3(80, 32.5, 0);
  const target = vec3(102, 34, 0); // para trás da baliza
  phys.kick(ball, target, 35, 4);

  let done = false;
  let steps = 0;
  let maxZ = 0;
  while (!done && steps < 2000) {
    done = phys.step(ball, DT, target);
    assertFiniteBall(ball);
    maxZ = Math.max(maxZ, ball.position.z);
    steps++;
  }
  assert.ok(done, "voo termina (chegada ou fora)");
  assert.ok(maxZ > 0.5, `houve voo vertical (maxZ=${maxZ.toFixed(2)})`);
});

test("passe rasteiro: chega ao receptor em movimento", () => {
  const phys = new BallPhysics();
  const ball = createBallState();
  ball.position = vec3(30, 20, 0);
  phys.kick(ball, vec3(45, 20, 0), 20, 0);

  // receptor a deslocar-se lateralmente
  const receiver = vec3(45, 20, 0);
  let done = false;
  let steps = 0;
  while (!done && steps < 600) {
    receiver.y += 0.15; // ~3 m/s
    done = phys.step(ball, DT, receiver);
    assertFiniteBall(ball);
    steps++;
  }
  assert.ok(done, "passe chega ao receptor");
  const d = Math.hypot(receiver.x - ball.position.x, receiver.y - ball.position.y);
  assert.ok(d < 1.5, `chegada perto do alvo (d=${d.toFixed(2)})`);
});

test("bola para trás da baliza: sai e termina", () => {
  const phys = new BallPhysics();
  const ball = createBallState();
  ball.position = vec3(98, 32.5, 0);
  phys.kick(ball, vec3(110, 32.5, 0), 30, 1.5);

  let done = false;
  let steps = 0;
  while (!done && steps < 600) {
    done = phys.step(ball, DT, null);
    assertFiniteBall(ball);
    steps++;
  }
  assert.ok(done, "bola sai de campo e o voo termina");
  assert.ok(ball.position.x > 100, "passou a linha da baliza");
});

test("ball quique no chão e vem a repouso (energia decai)", () => {
  const phys = new BallPhysics();
  const ball = createBallState();
  ball.position = vec3(50, 32.5, 0);
  phys.kick(ball, vec3(62, 32.5, 0), 8, 9); // arco alto, chega e quica

  let done = false;
  let steps = 0;
  let touchedGround = false;
  let bounced = false;
  let prevZ = 0;
  // sem homing: o arco tem de tocar o chão, quicar e vir a repouso
  while (!done && steps < 3000) {
    done = phys.step(ball, DT, null);
    assertFiniteBall(ball);
    if (prevZ <= 0.001 && ball.position.z > 0.1) bounced = true; // subiu após tocar
    if (ball.position.z <= 0.001) touchedGround = true;
    prevZ = ball.position.z;
    steps++;
  }
  assert.ok(touchedGround, "bola tocou o chão");
  assert.ok(bounced, "houve quique (restuição)");
  assert.ok(done, "bola vem a repouso");
  assert.ok(Math.hypot(ball.velocity.x, ball.velocity.y) < 2, "parou");
});

test("attach: cola a bola e zera velocidade", () => {
  const phys = new BallPhysics();
  const ball = createBallState();
  ball.position = vec3(10, 10, 0);
  phys.kick(ball, vec3(50, 50, 0), 30, 5);
  phys.attach(ball, vec3(44.2, 31.7, 0));
  assert.equal(ball.position.x, 44.2);
  assert.equal(ball.position.y, 31.7);
  assert.equal(ball.position.z, 0);
  assert.equal(ball.velocity.x, 0);
  assert.equal(ball.velocity.y, 0);
  assert.equal(ball.velocity.z, 0);
  // passo seguinte sem voo → termina logo
  assert.equal(phys.step(ball, DT, null), true);
});

test("separação: sobreposções resolvidas e dentro do campo", () => {
  const phys = new BallPhysics();
  const mk = (x: number, y: number): PlayerState =>
    ({ position: vec3(x, y, 0) }) as unknown as PlayerState;

  // dois colados
  const a = mk(50, 32.5);
  const b = mk(50.2, 32.5);
  phys.separate([a, b]);
  const d = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
  assert.ok(d >= 0.85, `separação mínima respeitada (d=${d.toFixed(2)})`);

  // amontoado de22 no centro
  const pile: PlayerState[] = [];
  for (let i = 0; i < 22; i++) pile.push(mk(50 + (i % 3) * 0.05, 32.5));
  phys.separate(pile);
  for (let i = 0; i < pile.length; i++) {
    const p = pile[i].position;
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.x >= 1 && p.x <= 99, "x dentro do campo");
    assert.ok(p.y >= 1 && p.y <= 64, "y dentro do campo");
    for (let j = i + 1; j < pile.length; j++) {
      const q = pile[j].position;
      const dd = Math.hypot(p.x - q.x, p.y - q.y);
      assert.ok(dd >= 0.8, `par ${i}-${j} separado (${dd.toFixed(2)})`);
    }
  }
});

test("física é determinística (mesmos inputs → mesmos outputs)", () => {
  const once = () => {
    const phys = new BallPhysics();
    const ball = createBallState();
    ball.position = vec3(20, 10, 0);
    phys.kick(ball, vec3(70, 50, 0), 24, 4);
    for (let i = 0; i < 200; i++) phys.step(ball, DT, vec3(70, 50, 0));
    return [ball.position.x, ball.position.y, ball.position.z];
  };
  assert.deepStrictEqual(once(), once());
});
