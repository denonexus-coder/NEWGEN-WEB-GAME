import { PlayerState, PlayerRole } from "../core/types/player";
import { BallState } from "../core/types/ball";
import { FieldState, createFieldState } from "../core/types/field";
import { Vector3D, vec3, vecDistance, vecLength, vecNormalize, vecAdd, vecScale } from "../core/math/vector3d";

/**
 * Goalkeeper AI
 *
 * Sistema de decisao do guarda-redes:
 * - Posicionamento otimo (linha bola-porta)
 * - Previsao e defesa de remates
 * - Saidas e um-contra-um
 * - Alcance de cruzamentos
 * - Distribuicao de bola
 */

export type GoalkeeperAction =
  | "hold_position" // Manter posicao na linha
  | "advance" // Sair a bola parada / apoiar
  | "rush_out" // Sai para cortar um-contra-um
  | "save_shot" // Defender remate
  | "claim_ball" // Alcanar cruzamento / sair a bola alta
  | "clear_ball" // Afastar com seguranca
  | "intercept" // Cortar passe/ bola entrelinhada
  | "distribute"; // Distribuir a bola

export interface GoalkeeperDecision {
  action: GoalkeeperAction;
  targetPosition: Vector3D;
  urgency: number; // 0-1
  confidence: number; // 0-1
  reason: string;
}

export interface ShotPrediction {
  /** Ponto onde a bola cruza a linha de remate */
  interceptPoint: Vector3D;
  /** Tempo ate a bola chegar (s) */
  timeToArrive: number;
  /** Distancia que o GR precisa percorrer (m) */
  distanceRequired: number;
  /** Velocidade minima necessaria (m/s) */
  requiredSpeed: number;
  /** Se a bola vai em direcao a baliza */
  onTarget: boolean;
  /** Se o GR consegue chegar */
  reachable: boolean;
}

export interface GoalkeeperContext {
  goalkeeper: PlayerState;
  ball: BallState;
  teammates: PlayerState[];
  opponents: PlayerState[];
  field?: FieldState;
}

export class GoalkeeperAI {
  private field: FieldState;
  /** Raio de acao do GR ao efetuar uma paragem (m) */
  private saveRadius = 2.0;
  /** Tempo de reacao (s) */
  private reactionTime = 0.35;

  constructor(field?: FieldState) {
    this.field = field || createFieldState();
  }

  /**
   * Posicao da propria baliza (GR da equipa defende este lado)
   * Equipa 1 ataca x=100 logo defende x=0.
   */
  getOwnGoal(teamId: number): Vector3D {
    return vec3(teamId === 1 ? 0 : this.field.width, this.field.height / 2, 0);
  }

  /**
   * Posicao da baliza adversaria
   */
  getOpponentGoal(teamId: number): Vector3D {
    return vec3(teamId === 1 ? this.field.width : 0, this.field.height / 2, 0);
  }

  // ==================== POSICIONAMENTO ====================

  /**
   * Posicao otima: na linha bola-baliza, com profundidade
   * proporcional a distancia da bola (fechar o angulo).
   */
  calculateOptimalPosition(context: GoalkeeperContext): Vector3D {
    const goal = this.getOwnGoal(context.goalkeeper.teamId);
    const ballPos = context.ball.position;

    const ballToGoal = vecDistance(ballPos, goal);

    // Bola muito perto da baliza: colar a linha, seguir a bola lateralmente
    if (ballToGoal < 8) {
      const linePoint = this.getPointOnLine(goal, ballPos, Math.min(ballToGoal * 0.1, 0.8));
      return this.limitToGoalArea(linePoint);
    }

    // Profundidade: fecha o angulo (distancia da bola * fator)
    // Bola longe → sai um pouco; bola aproxima → recua para a linha
    const depth = Math.max(1.5, Math.min(12, ballToGoal * 0.22));
    const point = this.getPointOnLine(goal, ballPos, depth);

    return this.limitToGoalArea(point);
  }

  /**
   * Ponto a uma distancia `dist` da origem em direcao ao alvo
   */
  private getPointOnLine(origin: Vector3D, target: Vector3D, dist: number): Vector3D {
    const direction = vec3(target.x - origin.x, target.y - origin.y, 0);
    const length = vecLength(direction);
    if (length < 0.0001) return vec3(origin.x + dist, origin.y, 0);

    const norm = vecScale(direction, 1 / length);
    const point = vec3(origin.x + norm.x * dist, origin.y + norm.y * dist, 0);
    return point;
  }

  /**
   * Mantem o GR dentro da area (lata de baliza + area)
   */
  private limitToGoalArea(p: Vector3D): Vector3D {
    const ownGoalX = p.x < this.field.width / 2 ? 0 : this.field.width;
    const isLeft = ownGoalX === 0;

    // Largura da area: 16m a partir da linha de baliza
    const areaDepth = 16;
    const minY = 32.5 - 20;
    const maxY = 32.5 + 20;

    let x = p.x;
    if (isLeft) {
      x = Math.max(0.5, Math.min(areaDepth, x));
    } else {
      x = Math.max(this.field.width - areaDepth, Math.min(this.field.width - 0.5, x));
    }

    const y = Math.max(minY, Math.min(maxY, p.y));
    return vec3(x, y, 0);
  }

  // ==================== PREVISAO DE REMATE ====================

  /**
   * Preve se um remate vai a baliza e onde defender.
   */
  predictShot(context: GoalkeeperContext): ShotPrediction | null {
    const velocity = context.ball.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    const goal = this.getOwnGoal(context.goalkeeper.teamId);
    const goalMouthHalfWidth = this.field.goalWidth / 2;

    if (speed < 5) return null; // Nao e remate

    // O remate vai em direcao a baliza? (velocidade e direcao a baliza com o mesmo sinal)
    const toGoal = vec3(goal.x - context.ball.position.x, 0, 0);
    const headingToGoal = velocity.x * toGoal.x > 0 && Math.abs(velocity.x) > 0.1;

    if (!headingToGoal) return null;

    // Tempo ate cruzar a linha da baliza
    const time = Math.abs(toGoal.x / velocity.x);
    if (time <= 0) return null;

    const interceptY = context.ball.position.y + velocity.y * time;
    const insideGoal = Math.abs(interceptY - goal.y) <= goalMouthHalfWidth + 1.5;

    const interceptPoint = vec3(goal.x, interceptY, 0);

    // Distancia que o GR precisa cobrir (da posicao atual ate ao ponto)
    const gk = context.goalkeeper;
    const distanceRequired = vecDistance(gk.position, interceptPoint);
    const availableTime = Math.max(0.25, time - this.reactionTime);
    const requiredSpeed = distanceRequired / availableTime;

    const gkMaxSpeed = this.getGoalkeeperMaxSpeed(gk);
    const reachable = requiredSpeed <= gkMaxSpeed;

    return {
      interceptPoint,
      timeToArrive: time,
      distanceRequired,
      requiredSpeed,
      onTarget: insideGoal,
      reachable: insideGoal ? reachable : false,
    };
  }

  /**
   * Velocidade maxima estimada do GR (m/s)
   */
  private getGoalkeeperMaxSpeed(gk: PlayerState): number {
    // pace/acceleration 0-100 → ~4 a 8 m/s + bonus de reacoes
    const base = 4 + (gk.physical.pace / 100) * 3 + (gk.physical.acceleration / 100) * 1;
    return base;
  }

  /**
   * Probabilidade de defesa (0-1)
   */
  evaluateSave(context: GoalkeeperContext, shot?: ShotPrediction): number {
    const prediction = shot || this.predictShot(context);
    if (!prediction || !prediction.onTarget) return 0;

    const gk = context.goalkeeper;
    const speedRatio = prediction.requiredSpeed / this.getGoalkeeperMaxSpeed(gk);

    // Chance cai com a dificuldade, sobe com qualidade
    let probability = 1 - Math.min(1, speedRatio * 0.55);
    probability += (gk.technical.positioning / 100) * 0.2;
    probability += (gk.physical.reactions / 100) * 0.15;
    probability += (gk.mental.anticipation / 100) * 0.1;

    // Chute muito forte e curto é mais difícil
    if (prediction.timeToArrive < 0.6) probability -= 0.08;

    // Piso realista: GR bem posicionado defende sempre com hipótese
    // substancial (calibrado para ~65-75% de defesa global — taxa real)
    probability = Math.max(probability, 0.65);

    return Math.max(0, Math.min(1, probability));
  }

  // ==================== DECISAO PRINCIPAL ====================

  /**
   * Decisao principal do guarda-redes.
   */
  decide(context: GoalkeeperContext): GoalkeeperDecision {
    const gk = context.goalkeeper;
    const ball = context.ball;
    const goal = this.getOwnGoal(gk.teamId);

    const distToBall = vecDistance(gk.position, ball.position);
    const distBallToGoal = vecDistance(ball.position, goal);
    const ballSpeed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);

    // 0. Bola na posse do GR → distribuir
    if (ball.possessionPlayer === gk.id) {
      const target = this.chooseDistribution(context);
      return {
        action: "distribute",
        targetPosition: gk.position,
        urgency: 0.4,
        confidence: target ? 0.9 : 0.5,
        reason: target
          ? `Distribuir para jogador ${target.id} (livre)`
          : "Distribuicao sem alvo claro - afastar",
      };
    }

    // 1. Remate a caminho da baliza
    const shot = this.predictShot(context);
    if (shot && shot.onTarget) {
      const saveProb = this.evaluateSave(context, shot);
      return {
        action: "save_shot",
        targetPosition: shot.interceptPoint,
        urgency: 1.0,
        confidence: saveProb,
        reason: `Remate preve ${shot.timeToArrive.toFixed(2)}s na porta (vel. necessaria ${shot.requiredSpeed.toFixed(1)} m/s)`,
      };
    }

    // 2. Bola a caminho da baliza mas fora (cortar/afastar)
    if (shot && !shot.onTarget && distBallToGoal < 30 && ballSpeed > 8) {
      return {
        action: "hold_position",
        targetPosition: this.calculateOptimalPosition(context),
        urgency: 0.3,
        confidence: 0.8,
        reason: "Remate fora - manter posicao",
      };
    }

    // 3. Bola alta/cruzamento dentro da area → alcancar
    if (this.isCrossIntoBox(context)) {
      const claimPoint = this.getClaimPoint(context);
      const gkCloser = this.isGkCloserThanDefenders(context, claimPoint);
      if (gkCloser) {
        return {
          action: "claim_ball",
          targetPosition: claimPoint,
          urgency: 0.85,
          confidence: 0.75,
          reason: "Cruzamento na area - alcancar a bola",
        };
      }
    }

    // 4. Um-contra-um / bola solta na area
    if (distBallToGoal < 25 && ball.possessionPlayer < 0) {
      const nearestOpponent = this.getNearestOpponentDistance(context, ball.position);
      const gkDistance = distToBall;

      if (gkDistance < nearestOpponent - 3) {
        return {
          action: "rush_out",
          targetPosition: vec3(ball.position.x, ball.position.y, 0),
          urgency: 0.9,
          confidence: 0.7,
          reason: `GR mais perto (${gkDistance.toFixed(1)}m) que adversario (${nearestOpponent.toFixed(1)}m) - sair`,
        };
      }

      // Adversario mais perto: fechar angulo na linha
      return {
        action: "hold_position",
        targetPosition: this.calculateOptimalPosition(context),
        urgency: 0.7,
        confidence: 0.65,
        reason: "Adversario mais perto - fechar angulo na linha",
      };
    }

    // 5. Bola parada muito perto / a caminho da area → interceptar
    if (ballSpeed > 3 && distBallToGoal < 20 && distToBall < 15) {
      return {
        action: "intercept",
        targetPosition: this.calculateOptimalPosition(context),
        urgency: 0.6,
        confidence: 0.7,
        reason: "Bola a caminho da area - interceptar linha",
      };
    }

    // 6. Bola longe → posicao otima / sair a apoiar
    if (distBallToGoal > 45) {
      return {
        action: "advance",
        targetPosition: this.calculateOptimalPosition(context),
        urgency: 0.2,
        confidence: 0.85,
        reason: "Bola longe - avancar na linha de passe",
      };
    }

    // 7. Padrao: manter posicao otima
    return {
      action: "hold_position",
      targetPosition: this.calculateOptimalPosition(context),
      urgency: 0.3,
      confidence: 0.8,
      reason: "Manter linha bola-baliza",
    };
  }

  // ==================== APOIO / UM CONTRA UM ====================

  /**
   * Decide sair ou recuar num um-contra-um.
   */
  evaluateOneOnOne(context: GoalkeeperContext): "rush_out" | "hold_position" {
    const gk = context.goalkeeper;
    const goal = this.getOwnGoal(gk.teamId);
    const distGkToBall = vecDistance(gk.position, context.ball.position);
    const distBallToGoal = vecDistance(context.ball.position, goal);

    // Bola ja muito perto da baliza: recuar/segurar angulo
    if (distBallToGoal < 6) return "hold_position";

    const nearestOpponent = this.getNearestOpponentDistance(context, context.ball.position);

    // Sair so se for claramente mais rapido chegar
    if (distGkToBall < nearestOpponent - 4 && distBallToGoal < 30) {
      return "rush_out";
    }

    return "hold_position";
  }

  // ==================== CRUZAMENTOS ====================

  private isCrossIntoBox(context: GoalkeeperContext): boolean {
    const gk = context.goalkeeper;
    const goal = this.getOwnGoal(gk.teamId);
    const isLeft = goal.x === 0;

    const ball = context.ball;
    const insideBox = isLeft
      ? ball.position.x < 16 && Math.abs(ball.position.y - 32.5) < 20
      : ball.position.x > this.field.width - 16 && Math.abs(ball.position.y - 32.5) < 20;

    const airborne = ball.ballHeight > 1.5 || Math.abs(ball.velocity.z) > 1;
    const incoming = isLeft ? ball.velocity.x < 0 : ball.velocity.x > 0;

    return insideBox && (airborne || incoming);
  }

  private getClaimPoint(context: GoalkeeperContext): Vector3D {
    const gk = context.goalkeeper;
    const goal = this.getOwnGoal(gk.teamId);

    // Ponto na trajetoria da bola dentro da area (aprox. 30% ate a baliza)
    const fraction = Math.min(1, Math.abs(context.ball.position.x - goal.x) / 30);

    return vec3(
      context.ball.position.x + (goal.x - context.ball.position.x) * fraction * 0.3,
      context.ball.position.y,
      0
    );
  }

  private isGkCloserThanDefenders(context: GoalkeeperContext, point: Vector3D): boolean {
    const gkDist = vecDistance(context.goalkeeper.position, point);

    for (const mate of context.teammates) {
      if (mate.id === context.goalkeeper.id) continue;
      if (mate.role === PlayerRole.Goalkeeper) continue;
      if (vecDistance(mate.position, point) < gkDist - 1.5) return false;
    }
    return true;
  }

  // ==================== DISTRIBUICAO ====================

  /**
   * Escolhe o melhor companheiro para distribuir a bola.
   * Prioriza: liberdade de marcacao + linha de passe + progressao.
   */
  chooseDistribution(context: GoalkeeperContext): PlayerState | null {
    const gk = context.goalkeeper;
    let best: PlayerState | null = null;
    let bestScore = -Infinity;

    for (const mate of context.teammates) {
      if (mate.id === gk.id) continue;
      if (mate.role === PlayerRole.Goalkeeper) continue;

      // Liberdade: distancia ao adversario mais proximo
      let nearestOpponent = Infinity;
      for (const opponent of context.opponents) {
        nearestOpponent = Math.min(
          nearestOpponent,
          vecDistance(mate.position, opponent.position)
        );
      }
      const freedom = Math.min(nearestOpponent, 30);

      // Linha de passe desimpedida
      const laneClear = this.isPassLaneClear(gk.position, mate.position, context.opponents);

      // Progressao: quanto mais avancado, melhor (mas nao demasiado se marcado)
      const progress = (mate.position.x / this.field.width) * 15;

      // Distancia ao GR (nem perto demais nem longe demais)
      const dist = vecDistance(gk.position, mate.position);
      const distScore = dist > 10 && dist < 60 ? 10 : 0;

      let score = freedom * 0.6 + progress + distScore + (laneClear ? 25 : -50);
      score += (gk.technical.passing / 100) * 5;

      if (score > bestScore) {
        bestScore = score;
        best = mate;
      }
    }

    return best;
  }

  /**
   * Verifica se a linha de passe esta livre
   */
  isPassLaneClear(from: Vector3D, to: Vector3D, opponents: PlayerState[]): boolean {
    const distance = vecDistance(from, to);
    const steps = Math.max(2, Math.ceil(distance / 1));

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const point = vec3(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 0);

      for (const opponent of opponents) {
        if (vecDistance(point, opponent.position) < 3) return false;
      }
    }
    return true;
  }

  // ==================== UTILITARIOS ====================

  private getNearestOpponentDistance(context: GoalkeeperContext, point: Vector3D): number {
    let min = Infinity;
    for (const opponent of context.opponents) {
      min = Math.min(min, vecDistance(opponent.position, point));
    }
    return min;
  }

  /**
   * Avalia o desempenho do GR numa jogada (0-1)
   */
  evaluatePerformance(
    gk: PlayerState,
    shotsFaced: number,
    savesMade: number,
    goalsConceded: number,
    crossesClaimed: number,
    crossesAvailable: number
  ): number {
    if (shotsFaced === 0 && crossesAvailable === 0) return 0.7; // Sem trabalho

    let score = 0;

    // Taxa de defesas
    if (shotsFaced > 0) {
      const saveRate = savesMade / shotsFaced;
      score += saveRate * 0.6;
      // Golos sofridos penalizam pouco mais
      score -= (goalsConceded / shotsFaced) * 0.1;
    }

    // Alcance de cruzamentos
    if (crossesAvailable > 0) {
      score += (crossesClaimed / crossesAvailable) * 0.3;
    } else {
      score += 0.15;
    }

    return Math.max(0, Math.min(1, score));
  }
}
