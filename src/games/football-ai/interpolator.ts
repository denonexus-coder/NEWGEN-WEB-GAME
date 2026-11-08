/**
 * Interpolação de snapshots — o client renderiza a ~60fps enquanto o server
 * produz a ~20tps. Guarda os últimos2 snapshots e amostra entre eles pelo
 * relógio de parede (funciona com qualquer timeScale).
 */
import type { Snapshot } from "../../shared/protocol";

/** Estado interpolado pronto a aplicar à cena (coordenadas de campo: x0..100, y0..65) */
export interface SampledState {
  /** 22 ×6: x, y, z, yaw, stamina, hasBall */
  players: Float32Array;
  /** 6: x, y, z, vx, vy, vz */
  ball: Float32Array;
  scoreHome: number;
  scoreAway: number;
  gameTime: number;
  possession: 1 | 2;
  ballInFlight: boolean;
  seq: number;
}

interface Timed {
  snap: Snapshot;
  wall: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** yaw em ângulo curto (evita dar a volta ao rodar) */
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Interpolator {
  private prev: Timed | null = null;
  private curr: Timed | null = null;

  push(snap: Snapshot): void {
    const wall = performance.now();
    if (this.curr) this.prev = this.curr;
    this.curr = { snap, wall };
  }

  reset(): void {
    this.prev = null;
    this.curr = null;
  }

  latest(): Snapshot | null {
    return this.curr?.snap ?? null;
  }

  /** último estado (sem interpolar) — serve para HUD/score */
  latestState(): SampledState | null {
    return this.curr ? flatten(this.curr.snap, this.curr.snap, 0) : null;
  }

  /** amostra interpolada no instante `wall` (default: agora) */
  sample(wall: number = performance.now()): SampledState | null {
    const c = this.curr;
    if (!c) return null;
    if (!this.prev) return flatten(c.snap, c.snap, 0);
    const span = c.wall - this.prev.wall;
    const t = span > 1 ? Math.min(1, Math.max(0, (wall - this.prev.wall) / span)) : 1;
    return flatten(this.prev.snap, c.snap, t);
  }
}

function flatten(a: Snapshot, b: Snapshot, t: number): SampledState {
  const players = new Float32Array(a.players.length);
  for (let i = 0; i < a.players.length; i += 6) {
    players[i] = lerp(a.players[i], b.players[i], t);
    players[i + 1] = lerp(a.players[i + 1], b.players[i + 1], t);
    players[i + 2] = lerp(a.players[i + 2], b.players[i + 2], t);
    players[i + 3] = lerpAngle(a.players[i + 3], b.players[i + 3], t);
    players[i + 4] = lerp(a.players[i + 4], b.players[i + 4], t);
    players[i + 5] = b.players[i + 5]; // hasBall: estado atual
  }
  const ball = new Float32Array(6);
  for (let i = 0; i < 6; i++) {
    ball[i] = lerp(a.ball[i], b.ball[i], t);
  }
  return {
    players,
    ball,
    scoreHome: b.scoreHome,
    scoreAway: b.scoreAway,
    gameTime: b.gameTime,
    possession: b.possession,
    ballInFlight: b.ballInFlight,
    seq: b.seq,
  };
}
