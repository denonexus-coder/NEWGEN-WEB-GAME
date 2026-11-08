/**
 * Física básica da bola + separação de jogadores.
 *
 * Implementa BallPhysicsAdapter (contrato em ../sim/simulation.ts):
 *  - kick:   impulso inicial (horizontal na direção do alvo + loft vertical)
 *  - step:   integração com sub-passos (0.02s), gravidade, arrasto, quique
 *            no chão, traves, parede das laterais, fora de jogo atrás das balizas
 *  - attach: cola a bola ao portador (posse retomada)
 *  - separate: resolve sobreposições entre jogadores (empurra metade cada)
 *
 * Nada de RNG aqui → determinismo vem só do simulador (Math.random stub).
 * Nada de DOM/three → o módulo corre no worker e em Node (testes).
 */
import type { BallPhysicsAdapter } from "../sim/simulation";
import type { BallState } from "../ai/core/types/ball";
import type { PlayerState } from "../ai/core/types/player";
import type { Vector3D } from "../ai/core/math/vector3d";

const GRAVITY = -9.81; // m/s²
const SUBSTEP = 0.02; // integração estável
const AIR_DRAG = 0.12; // /s enquanto voa
const ROLL_FRICTION = 0.5; // /s enquanto rola no chão (relva: passe morre ~40m a 20m/s)
const GROUND_RESTITUTION = 0.6; // perda na quique
const ARRIVE_DIST = 0.6; // m — chega ao alvo
const STOP_SPEED = 1.2; // m/s — bola parou
const WALL_RESTITUTION = 0.5; // laterais
const POST_RESTITUTION = 0.7; // traves
const PLAYER_RADIUS = 0.45; // raio efetivo (diam. de contato 0.9m)

const FIELD_W = 100;
const FIELD_H = 65;
const GOAL_X = { 1: 0, 2: 100 } as const; // baliza que CADA equipa defende
const GOAL_HALF = 3.67; // 7.34 / 2
const POST_R = 0.06;

export class BallPhysics implements BallPhysicsAdapter {
  private flying = false;

  kick(ball: BallState, target: Vector3D | null, speed: number, loft: number): void {
    const p = ball.position;
    const v = ball.velocity;
    let dx: number;
    let dy: number;
    if (target) {
      dx = target.x - p.x;
      dy = target.y - p.y;
    } else {
      // sem alvo: segue a direção atual (ou +x por omissão)
      dx = v.x;
      dy = v.y;
    }
    const d = Math.hypot(dx, dy);
    if (d > 1e-6) {
      v.x = (dx / d) * speed;
      v.y = (dy / d) * speed;
    } else {
      v.x = speed;
      v.y = 0;
    }
    v.z = Math.max(0, loft);
    p.z = Math.max(0, p.z);
    ball.isStopped = false;
    ball.isInPlay = true;
    this.flying = true;
  }

  /**
   * Integra `dt` em sub-passos. Devolve true quando o voo terminou
   * (chegou ao alvo / parou / saiu atrás de uma baliza / timeout do caller).
   */
  step(ball: BallState, dt: number, homing: Vector3D | null): boolean {
    if (!this.flying) return true;
    let remaining = Math.min(Math.max(dt, 0), 1); // teto de segurança
    while (remaining > 0 && this.flying) {
      const h = Math.min(SUBSTEP, remaining);
      this.integrate(ball, h, homing);
      remaining -= h;
      if (this.checkDone(ball, homing)) this.flying = false;
    }
    this.derive(ball);
    return !this.flying;
  }

  attach(ball: BallState, pos: Vector3D): void {
    ball.position.x = pos.x;
    ball.position.y = pos.y;
    ball.position.z = 0;
    ball.velocity.x = 0;
    ball.velocity.y = 0;
    ball.velocity.z = 0;
    ball.isStopped = true;
    this.flying = false;
    this.derive(ball);
  }

  separate(players: PlayerState[]): void {
    const n = players.length;
    const minD = PLAYER_RADIUS * 2; //0.9m
    const STACK = 0.3; // abaixo disto está empilhado, não só encostado

    // 1) clusters empilhados → explodem para um círculo determinístico
    //    (projeção pairwise sozinha converge demasiado devagar em pilhas grandes)
    const parent: number[] = [];
    for (let i = 0; i < n; i++) parent.push(i);
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const dist = (i: number, j: number): number => {
      const a = players[i].position;
      const b = players[j].position;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    let merged = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (dist(i, j) < STACK) {
          parent[find(i)] = find(j);
          merged = true;
        }
      }
    }
    if (merged) {
      const groups = new Map<number, number[]>();
      for (let i = 0; i < n; i++) {
        const r = find(i);
        const g = groups.get(r);
        if (g) g.push(i);
        else groups.set(r, [i]);
      }
      for (const group of groups.values()) {
        const k = group.length;
        if (k < 2) continue;
        let cx = 0;
        let cy = 0;
        for (const idx of group) {
          cx += players[idx].position.x;
          cy += players[idx].position.y;
        }
        cx /= k;
        cy /= k;
        // raio que garante ≥ minD entre vizinhos do círculo
        const R = minD / 2 / Math.sin(Math.PI / k);
        for (let m = 0; m < k; m++) {
          const ang = (2 * Math.PI * m) / k + 0.3141; // offset fixo (sem RNG)
          const p = players[group[m]].position;
          p.x = cx + Math.cos(ang) * R;
          p.y = cy + Math.sin(ang) * R;
        }
      }
    }

    // 2) passes de relaxamento pairwise (limpa sobreposições residuais)
    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        const a = players[i].position;
        for (let j = i + 1; j < n; j++) {
          const b = players[j].position;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          if (d >= minD) continue;
          moved = true;
          let push: number;
          if (d < 1e-6) {
            // centros coincidentes — empurra para fora na diagonal (determinístico)
            dx = (i % 2 === 0 ? 1 : -1) * (j % 2 === 0 ? 1 : -1);
            dy = 1;
            d = Math.SQRT2;
            push = minD / 2; // cada um sai metade da distância mínima
          } else {
            push = (minD - d) / 2;
          }
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
      if (!moved) break;
    }

    // 3) mantém dentro do campo (mesmos limites do simulador)
    for (const pl of players) {
      pl.position.x = Math.min(99, Math.max(1, pl.position.x));
      pl.position.y = Math.min(64, Math.max(1, pl.position.y));
    }
  }

  // ----------------------------------------------------------------- privado

  private integrate(ball: BallState, h: number, homing: Vector3D | null): void {
    const p = ball.position;
    const v = ball.velocity;

    // steering para o alvo vivo (passe segue o receptor em movimento)
    if (homing) {
      const dx = homing.x - p.x;
      const dy = homing.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-6) {
        const speed = Math.hypot(v.x, v.y);
        const blend = Math.min(1, 5 * h); // reorientação suave
        v.x += ((dx / d) * speed - v.x) * blend;
        v.y += ((dy / d) * speed - v.y) * blend;
      }
    }

    // gravidade + arrasto
    v.z += GRAVITY * h;
    const onGround = p.z <= 0.02 && v.z <= 0.5;
    const drag = onGround ? ROLL_FRICTION : AIR_DRAG;
    const damp = Math.max(0, 1 - drag * h);
    v.x *= damp;
    v.y *= damp;
    v.z *= Math.max(0, 1 - AIR_DRAG * h);

    // integra
    p.x += v.x * h;
    p.y += v.y * h;
    p.z += v.z * h;

    // chão
    if (p.z < 0) {
      p.z = 0;
      if (v.z < -0.4) {
        v.z = -v.z * GROUND_RESTITUTION;
      } else {
        v.z = 0;
      }
    }

    // traves das balizas (posts verticais)
    this.collidePosts(ball);

    // laterais: mantém dentro (a bola sai só para trás das balizas)
    if (p.y < 0) {
      p.y = 0;
      if (v.y < 0) v.y = -v.y * WALL_RESTITUTION;
    } else if (p.y > FIELD_H) {
      p.y = FIELD_H;
      if (v.y > 0) v.y = -v.y * WALL_RESTITUTION;
    }
  }

  private collidePosts(ball: BallState): void {
    const p = ball.position;
    const v = ball.velocity;
    if (p.z > 2.6) return; // acima da baliza (2.44m + margem)
    const r = POST_R + 0.11;
    for (const gx of [0, FIELD_W]) {
      for (const gy of [FIELD_H / 2 - GOAL_HALF, FIELD_H / 2 + GOAL_HALF]) {
        const dx = p.x - gx;
        const dy = p.y - gy;
        const d = Math.hypot(dx, dy);
        if (d >= r || d < 1e-6) continue;
        const nx = dx / d;
        const ny = dy / d;
        // empurra para fora
        p.x = gx + nx * r;
        p.y = gy + ny * r;
        // reflete a velocidade normal
        const vn = v.x * nx + v.y * ny;
        if (vn < 0) {
          v.x -= (1 + POST_RESTITUTION) * vn * nx;
          v.y -= (1 + POST_RESTITUTION) * vn * ny;
        }
      }
    }
  }

  private checkDone(ball: BallState, homing: Vector3D | null): boolean {
    const p = ball.position;
    const v = ball.velocity;

    // chegou ao destinatário (receptor em movimento)
    if (homing) {
      const d = Math.hypot(homing.x - p.x, homing.y - p.y);
      if (d < ARRIVE_DIST) return true;
    }

    // saiu para trás das balizas (baliza fora / escanteio decidido)
    if (p.x < -1 || p.x > FIELD_W + 1) return true;

    // parou no chão
    if (p.z <= 0.02 && Math.hypot(v.x, v.y) < STOP_SPEED && Math.abs(v.z) < 0.4) {
      return true;
    }
    return false;
  }

  /** campos derivados que o simulador/client consultam */
  private derive(ball: BallState): void {
    ball.ballSpeed = Math.hypot(ball.velocity.x, ball.velocity.y, ball.velocity.z);
    ball.ballHeight = ball.position.z;
    if (ball.ballSpeed > 0.01) {
      ball.ballAngle = Math.atan2(ball.velocity.y, ball.velocity.x);
    }
  }
}
