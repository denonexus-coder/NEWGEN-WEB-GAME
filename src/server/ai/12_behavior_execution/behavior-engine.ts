import { PlayerState, PlayerRole } from "../core/types/player";
import { BallState } from "../core/types/ball";
import { Vector3D, vec3, vecDistance, vecLength, vecAdd, vecScale, vecNormalize } from "../core/math/vector3d";
import { AIConfig } from "../core/config";
import { DecisionAction, DecisionOption, DecisionResult } from "../04_decision_engine/decision-engine";
import { CreativeOption, CreativeAction } from "../05_creative_engine/creative-engine";
import { GoalkeeperDecision, GoalkeeperAction } from "../11_goalkeeper_ai/goalkeeper-ai";
import { PersonalityEngine, GameContext as PersonalityGameContext } from "../02_personality_engine/personality-engine";
import { PathfindingEngine, Obstacle } from "../10_pathfinding_engine/pathfinding-engine";

/**
 * Behavior Execution Engine
 *
 * O ultimo elo da cadeia: transforma DECISOES em acoes executaveis.
 * - Mapeia decisoes (Decision/Creative/GK) em comportamentos
 * - Movimento com A* + steering + chegada (arrival)
 * - Execucao de acoes com probabilidade baseada em atributos
 * - Prioridade e interrupcao de comportamentos
 * - PORTAO DE SHOWBOATING: garante futebol normal na maioria das vezes
 */

export type BehaviorType =
  | "move"
  | "sprint"
  | "pass"
  | "shoot"
  | "dribble"
  | "skill_move"      // SSHOWBOATING - raro, so via portao da personalidade
  | "protect_ball"
  | "turn"
  | "tackle"
  | "intercept"
  | "clear"
  | "header"
  | "hold_position"
  | "wait"
  | "gk_save"
  | "gk_rush"
  | "gk_claim"
  | "gk_distribute";

export interface BehaviorCommand {
  type: BehaviorType;
  targetPosition: Vector3D;
  targetPlayerId?: number;
  /** Intensidade 0-1 (forca do remate/passe) */
  power: number;
  /** Multiplicador de velocidade de movimento 0-1.5 */
  speedMultiplier: number;
  /** Prioridade 0-1 (maior interrompe menor) */
  priority: number;
  /** Duracao em segundos (acao bloqueia outras) */
  duration: number;
  /** Segundos desde o inicio */
  elapsed: number;
  reason: string;
}

export interface MovementResult {
  velocity: Vector3D;
  speed: number;
  arrived: boolean;
  /** Distancia restante ao alvo */
  distance: number;
}

export interface ExecutionOutcome {
  executed: boolean;
  success: boolean;
  probability: number;
  detail: string;
}

interface CachedPath {
  goal: Vector3D;
  path: Vector3D[];
  stale: boolean;
}

export class BehaviorEngine {
  private config: AIConfig;
  private personalityEngine: PersonalityEngine;
  private pathfinder: PathfindingEngine;

  private current: BehaviorCommand | null = null;
  private pathCache: Map<number, CachedPath> = new Map();

  constructor(
    config: AIConfig,
    pathfinder?: PathfindingEngine,
    personalityEngine?: PersonalityEngine
  ) {
    this.config = config;
    this.pathfinder = pathfinder || new PathfindingEngine();
    this.personalityEngine = personalityEngine || new PersonalityEngine(config);
  }

  // ==================== MAPEAMENTO DE DECISOES ====================

  /**
   * Converte a decisao do Decision Engine num comportamento executavel.
   */
  executeDecision(
    decision: DecisionResult,
    player: PlayerState,
    ball: BallState
  ): BehaviorCommand {
    const option = decision.selectedAction;
    const base = this.baseCommand(option.targetPosition, option.targetPlayerId);

    switch (option.action) {
      case DecisionAction.PassShort:
      case DecisionAction.PassThrough:
      case DecisionAction.PassLob:
      case DecisionAction.PassOneTouch:
        return {
          ...base,
          type: "pass",
          power: this.passPowerFor(option.action),
          speedMultiplier: 0.6,
          priority: 0.7,
          duration: 0.4,
          reason: `Passe ${option.action} para jogador ${option.targetPlayerId ?? "?"}`,
        };

      case DecisionAction.Shoot:
      case DecisionAction.ShootPower:
      case DecisionAction.ShootFinesse:
      case DecisionAction.ShootChip:
        return {
          ...base,
          type: "shoot",
          power: option.action === DecisionAction.ShootPower ? 1 : option.action === DecisionAction.ShootChip ? 0.5 : 0.8,
          speedMultiplier: 0.5,
          priority: 0.95,
          duration: 0.5,
          reason: `Remate ${option.action} (confianca ${option.confidence.toFixed(2)})`,
        };

      case DecisionAction.Dribble:
      case DecisionAction.DribbleFeint:
      case DecisionAction.DribbleNutmeg:
        return {
          ...base,
          type: "dribble",
          power: 0.5,
          speedMultiplier: 0.9,
          priority: 0.6,
          duration: 1.0,
          reason: `Drible ${option.action}`,
        };

      case DecisionAction.ProtectBall:
        return { ...base, type: "protect_ball", power: 0.5, speedMultiplier: 0.3, priority: 0.6, duration: 1.2, reason: "Proteger a bola" };

      case DecisionAction.Turn:
        return { ...base, type: "turn", power: 0.3, speedMultiplier: 0.4, priority: 0.5, duration: 0.5, reason: "Rodar com a bola" };

      case DecisionAction.FindSpace:
      case DecisionAction.WaitMovement:
        return {
          ...base,
          type: "move",
          power: 0,
          speedMultiplier: option.action === DecisionAction.FindSpace ? 1.0 : 0.3,
          priority: 0.4,
          duration: 1.5,
          reason: option.action === DecisionAction.FindSpace ? "Procurar espaco" : "Movimentar para receber",
        };

      case DecisionAction.IndividualPlay:
        return { ...base, type: "sprint", power: 0.6, speedMultiplier: 1.2, priority: 0.6, duration: 1.5, reason: "Jogo individual" };

      case DecisionAction.Clear:
        return { ...base, type: "clear", power: 1.0, speedMultiplier: 0.5, priority: 0.9, duration: 0.4, reason: "Afastar a bola" };

      case DecisionAction.Header:
        return { ...base, type: "header", power: 0.7, speedMultiplier: 0.4, priority: 0.75, duration: 0.4, reason: "Cabeca" };

      case DecisionAction.Volley:
      case DecisionAction.Overhead:
        return { ...base, type: "shoot", power: 1.0, speedMultiplier: 0.5, priority: 0.9, duration: 0.6, reason: `Acrobatico ${option.action}` };

      default:
        return { ...base, type: "wait", power: 0, speedMultiplier: 0.2, priority: 0.3, duration: 0.5, reason: "Aguardar" };
    }
  }

  /**
   * Converte uma opcao criativa em comportamento.
   *
   * PORTAO DE SHOWBOATING (regra principal do projeto):
   * - Jogador disciplinado (>=50) NUNCA faz skill_move → joga futebol
   * - So desbloqueia se a personalidade allow E shouldShowboat() passar
   * - Caso contrario, faz a acao NORMAL equivalente (passe/remate/drible)
   */
  executeCreative(
    option: CreativeOption,
    player: PlayerState,
    gameContext: PersonalityGameContext
  ): BehaviorCommand {
    const category = this.creativeCategory(option.action);
    const impressiveness = option.impressiveness;

    const allowed =
      player.personality.discipline < 50 &&
      impressiveness >= 0.4 &&
      this.personalityEngine.shouldShowboat(player, gameContext);

    // Acao normal equivalente
    const normalAction: Record<string, () => BehaviorCommand> = {
      dribble: () => ({
        ...this.baseCommand(player.position, undefined),
        type: "dribble",
        power: 0.5,
        speedMultiplier: 0.9,
        priority: 0.6,
        duration: 1.0,
        reason: `${option.action} normalizado → drible (joga futebol)`,
      }),
      pass: () => ({
        ...this.baseCommand(player.position, undefined),
        type: "pass",
        power: 0.7,
        speedMultiplier: 0.6,
        priority: 0.7,
        duration: 0.4,
        reason: `${option.action} normalizado → passe`,
      }),
      shoot: () => ({
        ...this.baseCommand(player.position, undefined),
        type: "shoot",
        power: 0.85,
        speedMultiplier: 0.5,
        priority: 0.95,
        duration: 0.5,
        reason: `${option.action} normalizado → remate`,
      }),
    };

    if (!allowed) {
      return normalAction[category]();
    }

    // Showboating autorizado pela personalidade
    return {
      ...this.baseCommand(player.position, undefined),
      type: "skill_move",
      power: 0.6,
      speedMultiplier: 1.0,
      priority: 0.65,
      duration: 1.4,
      reason: `Skill move ${option.action} (showboating autorizado, impr. ${impressiveness.toFixed(2)})`,
    };
  }

  /**
   * Converte a decisao do Goalkeeper AI em comportamento.
   */
  executeGoalkeeper(decision: GoalkeeperDecision): BehaviorCommand {
    const base = this.baseCommand(decision.targetPosition, undefined);
    const map: Record<GoalkeeperAction, BehaviorType> = {
      hold_position: "hold_position",
      advance: "move",
      rush_out: "gk_rush",
      save_shot: "gk_save",
      claim_ball: "gk_claim",
      clear_ball: "clear",
      intercept: "intercept",
      distribute: "gk_distribute",
    };

    const type = map[decision.action];
    const isStatic = type === "hold_position";

    return {
      ...base,
      type,
      power: type === "gk_save" ? 1 : type === "clear" ? 1 : 0.6,
      speedMultiplier: decision.urgency > 0.8 ? 1.3 : isStatic ? 0 : 0.8,
      priority: type === "gk_save" ? 1.0 : decision.urgency,
      duration: isStatic ? 0.2 : 0.5,
      reason: `GR: ${decision.action} - ${decision.reason}`,
    };
  }

  // ==================== CICLO / PRIORIDADES ====================

  /**
   * Avanca o temporizador do comportamento atual.
   */
  update(dt: number): void {
    if (!this.current) return;
    this.current.elapsed += dt;
    if (this.current.elapsed >= this.current.duration) {
      this.current = null;
    }
  }

  /**
   * Tenta iniciar um novo comportamento respeitando prioridade.
   * Retorna false se o atual nao pode ser interrompido.
   */
  tryStart(command: BehaviorCommand): boolean {
    if (this.current && this.current.elapsed < this.current.duration) {
      // Só interrompe se a nova acao tem prioridade claramente maior
      if (command.priority < this.current.priority + 0.1) {
        return false;
      }
    }
    this.current = { ...command, elapsed: 0 };
    return true;
  }

  getCurrent(): BehaviorCommand | null {
    return this.current;
  }

  isBusy(): boolean {
    return this.current !== null;
  }

  /**
   * Percentagem de execucao do comportamento atual (0-1)
   */
  getProgress(): number {
    if (!this.current) return 1;
    return Math.min(1, this.current.elapsed / this.current.duration);
  }

  // ==================== MOVIMENTO ====================

  /**
   * Atualiza o movimento do jogador em direcao ao alvo.
   * Usa A* (com cache) + steering + desaceleracao na chegada.
   */
  updateMovement(
    player: PlayerState,
    target: Vector3D,
    obstacles: Obstacle[],
    dt: number,
    sprint = false
  ): MovementResult {
    const distance = vecDistance(player.position, target);

    // Raio de chegada
    const arrivalRadius = 1.0;
    if (distance <= arrivalRadius) {
      this.pathCache.delete(player.id);
      return { velocity: vec3(0, 0, 0), speed: 0, arrived: true, distance };
    }

    // Recalcular caminho se necessario (cache)
    let cached = this.pathCache.get(player.id);
    const targetMoved = cached ? vecDistance(cached.goal, target) > 3 : true;

    if (!cached || targetMoved || cached.stale) {
      const path = this.pathfinder.findPath(player.position, target, obstacles);
      cached = { goal: vec3(target.x, target.y, target.z), path, stale: false };
      this.pathCache.set(player.id, cached);
    }

    // Steering: se sem caminho, vai direto (evitando obstaculos por forca)
    let direction: Vector3D;
    if (cached.path.length >= 2) {
      direction = this.pathfinder.getSteering(cached.path, player.position, 1.5);
      // Marcar caminho usado como parcialmente gasto
      if (vecDistance(cached.path[cached.path.length - 1], player.position) < 2) {
        cached.stale = true;
      }
    } else {
      direction = vecNormalize(vec3(target.x - player.position.x, target.y - player.position.y, 0));
    }

    // Evitacao local de obstaculos proximos
    const avoidance = this.pathfinder.computeAvoidance(
      player.position,
      direction,
      obstacles,
      4
    );
    const desired = vec3(
      direction.x + avoidance.x,
      direction.y + avoidance.y,
      0
    );
    const desiredNorm = vecLength(desired) > 0.0001 ? vecNormalize(desired) : direction;

    // Velocidade maxima (atributos fisicos + stamina + sprint)
    const staminaFactor = 0.6 + (player.stamina / 100) * 0.4;
    const maxSpeed =
      (5 + (player.physical.pace / 100) * 4) * // 5-9 m/s
      staminaFactor *
      (sprint ? 1.3 : 1);

    // Desacelerar na chegada
    const slowDown = distance < 5 ? distance / 5 : 1;
    const targetSpeed = Math.min(maxSpeed, maxSpeed * slowDown);

    // Aceleracao limitada (nao teleporta)
    const desiredVelocity = vecScale(desiredNorm, targetSpeed);
    const accel = 12 * dt; // m/s^2
    const velocity = this.approach(player.velocity, desiredVelocity, accel);

    return { velocity, speed: vecLength(velocity), arrived: false, distance };
  }

  private approach(current: Vector3D, target: Vector3D, maxDelta: number): Vector3D {
    const diff = vec3(target.x - current.x, target.y - current.y, target.z - current.z);
    const len = vecLength(diff);
    if (len <= maxDelta) return vec3(target.x, target.y, target.z);
    const scale = maxDelta / len;
    return vec3(
      current.x + diff.x * scale,
      current.y + diff.y * scale,
      current.z + diff.z * scale
    );
  }

  // ==================== EXECUCAO DE ACOES ====================

  /**
   * Executa o comportamento atual e devolve o resultado.
   * A probabilidade vem dos atributos do jogador.
   */
  execute(player: PlayerState, ball: BallState, opponents: PlayerState[]): ExecutionOutcome {
    if (!this.current) {
      return { executed: false, success: false, probability: 0, detail: "Sem comportamento ativo" };
    }

    const command = this.current;

    switch (command.type) {
      case "pass":
        return this.executePass(player, opponents, command.targetPlayerId !== undefined);
      case "shoot":
        return this.executeShot(player, ball, opponents);
      case "dribble":
        return this.executeDribble(player, opponents);
      case "tackle":
        return this.executeTackle(player, opponents);
      case "clear":
        return { executed: true, success: true, probability: 0.9, detail: "Bola afastada" };
      case "skill_move":
        return this.executeSkillMove(player, opponents);
      case "gk_save":
        return { executed: true, success: Math.random() < 0.75, probability: 0.75, detail: "Paragem executada" };
      default:
        return { executed: true, success: true, probability: 1, detail: `Comportamento ${command.type} executado` };
    }
  }

  /**
   * Probabilidade de passe acertar (atributos + distancia + pressao)
   */
  evaluatePass(player: PlayerState, distance: number, pressureLevel: number): number {
    const base = player.technical.passing / 100;
    const vision = player.mental.decisions / 100;

    // Distancia reduz precisao
    const distanceFactor = Math.max(0.5, 1 - distance / 100);
    // Pressao reduz
    const pressureFactor = 1 - pressureLevel * 0.35;

    return Math.max(0.05, Math.min(0.98, base * 0.6 + vision * 0.2 + 0.2) * distanceFactor * pressureFactor + 0.1);
  }

  /**
   * Probabilidade de remate ir a baliza / marcar
   */
  evaluateShot(player: PlayerState, distanceToGoal: number, pressureLevel: number): number {
    const base = player.technical.shooting / 100;
    const composure = player.mental.composure / 100;

    const distanceFactor = Math.max(0.3, 1 - distanceToGoal / 60);
    const pressureFactor = 1 - pressureLevel * 0.3;

    return Math.max(0.05, Math.min(0.95, (base * 0.6 + composure * 0.2 + 0.2) * distanceFactor * pressureFactor + 0.05));
  }

  /**
   * Probabilidade de drible ter sucesso
   */
  evaluateDribble(player: PlayerState, opponent: PlayerState | null): number {
    const base = player.technical.dribbling / 100;
    const agility = player.physical.agility / 100;

    if (!opponent) return 0.95; // Sem oponente: facil

    const opponentSkill = opponent.technical.tackling / 100;
    const contest = base * 0.5 + agility * 0.2 + 0.15 - opponentSkill * 0.35;

    return Math.max(0.1, Math.min(0.95, contest + 0.3));
  }

  /**
   * Probabilidade de desarme ter sucesso
   */
  evaluateTackle(player: PlayerState, opponent: PlayerState | null): number {
    const base = player.technical.tackling / 100;
    const aggression = player.personality.aggressiveness / 100;

    if (!opponent) return 0.9;

    const opponentDribble = opponent.technical.dribbling / 100;
    const contest = base * 0.55 + aggression * 0.15 + 0.15 - opponentDribble * 0.3;

    return Math.max(0.1, Math.min(0.9, contest + 0.25));
  }

  // --- Execucoes com rolagem ---

  private executePass(player: PlayerState, opponents: PlayerState[], hasTarget: boolean): ExecutionOutcome {
    const nearest = this.nearestOpponentDistance(player, opponents);
    const pressure = Math.max(0, 1 - nearest / 15);
    const distance = 15; // media curta por defeito
    const probability = this.evaluatePass(player, distance, pressure);
    const success = Math.random() < probability;
    return {
      executed: true,
      success,
      probability,
      detail: success ? `Passe concluido (p=${probability.toFixed(2)})` : `Passe falhado (p=${probability.toFixed(2)})`,
    };
  }

  private executeShot(player: PlayerState, ball: BallState, opponents: PlayerState[]): ExecutionOutcome {
    const goalX = player.teamId === 1 ? 100 : 0;
    const distance = vecDistance(player.position, vec3(goalX, 32.5, 0));
    const nearest = this.nearestOpponentDistance(player, opponents);
    const pressure = Math.max(0, 1 - nearest / 10);
    const probability = this.evaluateShot(player, distance, pressure);
    const success = Math.random() < probability;
    return {
      executed: true,
      success,
      probability,
      detail: success ? `Remate certo (p=${probability.toFixed(2)}, ${distance.toFixed(0)}m)` : `Remate falhado (p=${probability.toFixed(2)})`,
    };
  }

  private executeDribble(player: PlayerState, opponents: PlayerState[]): ExecutionOutcome {
    const opponent = this.nearestOpponent(player, opponents);
    const probability = this.evaluateDribble(player, opponent);
    const success = Math.random() < probability;
    return {
      executed: true,
      success,
      probability,
      detail: success ? `Drible bem sucedido (p=${probability.toFixed(2)})` : `Drible perdido (p=${probability.toFixed(2)})`,
    };
  }

  private executeTackle(player: PlayerState, opponents: PlayerState[]): ExecutionOutcome {
    const opponent = this.nearestOpponent(player, opponents);
    const probability = this.evaluateTackle(player, opponent);
    const success = Math.random() < probability;
    return {
      executed: true,
      success,
      probability,
      detail: success ? `Desarme certo (p=${probability.toFixed(2)})` : `Desarme falhado (p=${probability.toFixed(2)})`,
    };
  }

  private executeSkillMove(player: PlayerState, opponents: PlayerState[]): ExecutionOutcome {
    // Skills sao arriscadas: dificuldade proporcional a impressionamento
    const opponent = this.nearestOpponent(player, opponents);
    const probability = this.evaluateDribble(player, opponent) * 0.8;
    const success = Math.random() < probability;
    return {
      executed: true,
      success,
      probability,
      detail: success
        ? `Skill move bem sucedida (p=${probability.toFixed(2)})`
        : `Skill move falhada (p=${probability.toFixed(2)}) - perdeu a bola`,
    };
  }

  // ==================== UTILITARIOS ====================

  private baseCommand(target: Vector3D, targetPlayerId?: number): Omit<BehaviorCommand, "type" | "power" | "speedMultiplier" | "priority" | "duration" | "reason"> & { targetPosition: Vector3D; targetPlayerId?: number } {
    return {
      targetPosition: vec3(target.x, target.y, target.z),
      ...(targetPlayerId !== undefined ? { targetPlayerId } : {}),
      elapsed: 0,
    };
  }

  private passPowerFor(action: DecisionAction): number {
    switch (action) {
      case DecisionAction.PassLob: return 0.8;
      case DecisionAction.PassThrough: return 0.75;
      case DecisionAction.PassOneTouch: return 0.6;
      default: return 0.65;
    }
  }

  private creativeCategory(action: CreativeAction): "dribble" | "pass" | "shoot" {
    const a = String(action);
    if (a.includes("PASS") || a.includes("BALL")) return "pass";
    if (a.includes("SHOT") || a.includes("VOLLEY")) return "shoot";
    return "dribble";
  }

  private nearestOpponent(player: PlayerState, opponents: PlayerState[]): PlayerState | null {
    let best: PlayerState | null = null;
    let bestDist = Infinity;
    for (const o of opponents) {
      const d = vecDistance(player.position, o.position);
      if (d < bestDist) {
        bestDist = d;
        best = o;
      }
    }
    return best;
  }

  private nearestOpponentDistance(player: PlayerState, opponents: PlayerState[]): number {
    const o = this.nearestOpponent(player, opponents);
    return o ? vecDistance(player.position, o.position) : 50;
  }

  /**
   * Limpa cache de caminhos (ex: apos mudanca de fase)
   */
  clearPathCache(): void {
    this.pathCache.clear();
  }
}
