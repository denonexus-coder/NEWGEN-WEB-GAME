import { PlayerState, PlayerRole } from "../core/types/player";
import { BallState } from "../core/types/ball";
import { Vector3D, vec3, vecDistance, vecLength, vecNormalize, vecAdd, vecScale } from "../core/math/vector3d";
import { AIConfig } from "../core/config";
import { FormationSystem, create442, TacticalFormation } from "../02_personality_engine/formation-system";

/**
 * Tactical Engine
 *
 * Sistema de posicionamento tático:
 * - Posicionamento baseado em formação
 * - Movimento ofensivo e defensivo
 * - Coordenação de equipe
 * - Gestão de espaço
 */

export type TacticalPhase = "possession" | "transition" | "defending" | "setpiece";

export interface PositioningTarget {
  position: Vector3D;
  priority: number; // 0-1
  reason: string;
}

export interface SpaceAnalysis {
  position: Vector3D;
  openness: number; // 0-100
  threatLevel: number; // 0-100
  value: number; // 0-100
}

export class TacticalEngine {
  private config: AIConfig;
  private formationSystem: FormationSystem;

  // Estado tático atual
  private currentPhase: TacticalPhase = "possession";
  private teamShape: Map<number, Vector3D> = new Map();

  constructor(config: AIConfig) {
    this.config = config;
    this.formationSystem = new FormationSystem(create442());
  }

  /**
   * Define a formação usada pelo motor tático
   */
  setFormation(formation: TacticalFormation): void {
    this.formationSystem.setFormation(formation);
  }

  /**
   * Define fase tática atual
   */
  setPhase(phase: TacticalPhase): void {
    this.currentPhase = phase;
  }

  /**
   * Obtém fase tática atual
   */
  getPhase(): TacticalPhase {
    return this.currentPhase;
  }

  /**
   * Calcula posição ideal para jogador
   */
  calculateIdealPosition(
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[],
    opponents: PlayerState[]
  ): PositioningTarget {
    // Posição base da formação
    const formationPos = this.formationSystem.getFormation().getPositionForRole(player.role);
    if (!formationPos) {
      return {
        position: player.position,
        priority: 0.5,
        reason: "No formation position",
      };
    }

    let targetX = formationPos.x;
    let targetY = formationPos.y;

    // Ajustar baseado na fase
    switch (this.currentPhase) {
      case "possession":
        targetX += this.calculatePossessionAdjustment(player, ball, teammates);
        break;
      case "defending":
        targetX += this.calculateDefendingAdjustment(player, ball, opponents);
        break;
      case "transition":
        targetX += this.calculateTransitionAdjustment(player, ball);
        break;
      case "setpiece":
        // Posição fixa em bola parada
        break;
    }

    // Ajustar lateralmente baseado na bola
    targetY += this.calculateLateralAdjustment(player, ball);

    // Limitar ao campo
    targetX = Math.max(5, Math.min(95, targetX));
    targetY = Math.max(5, Math.min(60, targetY));

    const position = vec3(targetX, targetY, 0);

    return {
      position,
      priority: this.calculatePositionPriority(player, ball),
      reason: this.getPhaseReason(),
    };
  }

  /**
   * Calcula melhor espaço para ocupar
   */
  findBestSpace(
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[],
    opponents: PlayerState[]
  ): SpaceAnalysis[] {
    const spaces: SpaceAnalysis[] = [];
    const gridSize = 10; // 10x10 grid

    for (let x = 10; x <= 90; x += gridSize) {
      for (let y = 10; y <= 55; y += gridSize) {
        const position = vec3(x, y, 0);
        const analysis = this.analyzeSpace(position, player, ball, teammates, opponents);
        spaces.push(analysis);
      }
    }

    // Ordenar por valor
    spaces.sort((a, b) => b.value - a.value);

    return spaces;
  }

  /**
   * Analisa um espaço específico do campo
   */
  private analyzeSpace(
    position: Vector3D,
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[],
    opponents: PlayerState[]
  ): SpaceAnalysis {
    // Abertura: distância ao adversário mais próximo
    let minDistToOpponent = Infinity;
    for (const opponent of opponents) {
      minDistToOpponent = Math.min(
        minDistToOpponent,
        vecDistance(position, opponent.position)
      );
    }
    const openness = Math.min(100, (minDistToOpponent / 20) * 100);

    // Ameaça: quão perto está da porta própria e de adversários
    const ownGoal = vec3(0, 32.5, 0);
    const distToOwnGoal = vecDistance(position, ownGoal);
    const threatLevel = Math.max(
      0,
      100 - (distToOwnGoal / 100) * 100 - openness * 0.3
    );

    // Valor: espaço aberto + progressão ofensiva + distância da bola
    const distToBall = vecDistance(position, ball.position);
    const progression = (position.x / 100) * 40; // Quanto mais avançado, melhor em ataque
    const ballProximity = Math.max(0, 30 - Math.abs(distToBall - 15));
    const teammatePenalty = this.calculateTeammateOverlap(position, teammates);

    const value = Math.max(
      0,
      Math.min(100, openness * 0.35 + progression + ballProximity - teammatePenalty)
    );

    return { position, openness, threatLevel, value };
  }

  /**
   * Penaliza espaços já ocupados por colegas
   */
  private calculateTeammateOverlap(
    position: Vector3D,
    teammates: PlayerState[]
  ): number {
    let penalty = 0;
    for (const teammate of teammates) {
      const dist = vecDistance(position, teammate.position);
      if (dist < 10) {
        penalty += (10 - dist) * 3;
      }
    }
    return penalty;
  }

  /**
   * Calcula movimento ofensivo
   */
  calculateOffensiveMovement(
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[],
    opponents: PlayerState[]
  ): Vector3D {
    const movement = vec3(0, 0, 0);

    // Atacantes avançam
    if (this.isOffensiveRole(player.role)) {
      movement.x += 5; // Avançar
      movement.y += this.calculateWidthAdjustment(player, ball);
    }

    // Meio-campistas oferecem opções
    if (player.role === PlayerRole.MidfielderCenter) {
      movement.x += 2;
      movement.y += this.calculateSupportAngle(player, ball, teammates);
    }

    // Defesas mantêm linha
    if (this.isDefensiveRole(player.role)) {
      movement.x += 1; // Subir ligeiramente
    }

    return movement;
  }

  /**
   * Calcula movimento defensivo
   */
  calculateDefensiveMovement(
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[],
    opponents: PlayerState[]
  ): Vector3D {
    const movement = vec3(0, 0, 0);

    // Todos voltam para trás
    movement.x -= 3;

    // Defesas ficam mais atrás
    if (this.isDefensiveRole(player.role)) {
      movement.x -= 2;
    }

    // Meio-campistas fecham espaços
    if (player.role === PlayerRole.MidfielderDefensive) {
      movement.y += this.calculateClosingAngle(player, ball, opponents);
    }

    // Extremos voltam para ajudar
    if (player.role === PlayerRole.WingerLeft || player.role === PlayerRole.WingerRight) {
      movement.x -= 2;
      movement.y += this.calculateRecoveryPosition(player, ball);
    }

    return movement;
  }

  /**
   * Calcula melhor ângulo de apoio
   */
  calculateSupportAngle(
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[]
  ): number {
    // Encontrar ângulo que oferece linha de passe
    let bestAngle = 0;
    let bestScore = -Infinity;

    for (let angle = -60; angle <= 60; angle += 15) {
      const radian = (angle * Math.PI) / 180;
      const testPos = vec3(
        player.position.x + Math.cos(radian) * 10,
        player.position.y + Math.sin(radian) * 10,
        0
      );

      const score = this.evaluatePosition(testPos, ball, teammates);
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }

    return bestAngle;
  }

  /**
   * Calcula melhor espaço para corte defensivo
   */
  calculateClosingAngle(
    player: PlayerState,
    ball: BallState,
    opponents: PlayerState[]
  ): number {
    // Encontrar melhor posição para cortar passes
    let bestAngle = 0;
    let bestScore = -Infinity;

    for (let angle = -45; angle <= 45; angle += 15) {
      const radian = (angle * Math.PI) / 180;
      const testPos = vec3(
        player.position.x + Math.cos(radian) * 8,
        player.position.y + Math.sin(radian) * 8,
        0
      );

      const score = this.evaluateDefensivePosition(testPos, ball, opponents);
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }

    return bestAngle;
  }

  /**
   * Calcula posição de recuperação
   */
  calculateRecoveryPosition(player: PlayerState, ball: BallState): number {
    // Voltar para posição defensiva
    const ballSide = ball.position.y > 32.5 ? 1 : -1;
    return ballSide * -5; // Ir para lado oposto à bola
  }

  /**
   * Calcula ajuste de largura
   */
  calculateWidthAdjustment(player: PlayerState, ball: BallState): number {
    // Jogadores afastam-se para criar largura
    const centerField = 32.5;
    const deviation = ball.position.y - centerField;

    // Extremos ficam mais largos
    if (player.role === PlayerRole.WingerLeft || player.role === PlayerRole.WingerRight) {
      return deviation > 0 ? -5 : 5;
    }

    return 0;
  }

  /**
   * Calcula ajuste para fase de posse
   */
  private calculatePossessionAdjustment(
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[]
  ): number {
    // Com bola, time sobe
    const ballProgression = (ball.position.x - 50) * 0.3;
    return ballProgression;
  }

  /**
   * Calcula ajuste para fase defensiva
   */
  private calculateDefendingAdjustment(
    player: PlayerState,
    ball: BallState,
    opponents: PlayerState[]
  ): number {
    // Sem bola, time recua
    const ballPosition = (ball.position.x - 50) * 0.2;
    return -ballPosition - 5;
  }

  /**
   * Calcula ajuste para transição
   */
  private calculateTransitionAdjustment(
    player: PlayerState,
    ball: BallState
  ): number {
    // Em transição, comportamento misto
    const adjustment = (ball.position.x - 50) * 0.1;
    return adjustment;
  }

  /**
   * Calcula ajuste lateral
   */
  private calculateLateralAdjustment(player: PlayerState, ball: BallState): number {
    // Acompanhar bola lateralmente
    const ballLateral = (ball.position.y - 32.5) * 0.2;
    return ballLateral;
  }

  /**
   * Calcula prioridade de posição
   */
  private calculatePositionPriority(player: PlayerState, ball: BallState): number {
    const distToBall = vecDistance(player.position, ball.position);

    // Mais próximo da bola = maior prioridade
    return Math.max(0, 1 - distToBall / 50);
  }

  /**
   * Obtém razão da fase atual
   */
  private getPhaseReason(): string {
    const reasons: Record<TacticalPhase, string> = {
      possession: "Building attack",
      defending: "Maintaining shape",
      transition: "Quick counter",
      setpiece: "Set piece position",
    };
    return reasons[this.currentPhase];
  }

  /**
   * Avalia uma posição (ofensiva)
   */
  private evaluatePosition(
    position: Vector3D,
    ball: BallState,
    teammates: PlayerState[]
  ): number {
    let score = 0;

    // Próximo da bola é bom
    const distToBall = vecDistance(position, ball.position);
    score += (1 - distToBall / 50) * 30;

    // Longe de colegas (espaço)
    let minDistToTeammate = Infinity;
    for (const teammate of teammates) {
      const dist = vecDistance(position, teammate.position);
      minDistToTeammate = Math.min(minDistToTeammate, dist);
    }
    score += Math.min(minDistToTeammate / 20, 1) * 20;

    // No campo
    if (position.x >= 10 && position.x <= 90 && position.y >= 10 && position.y <= 55) {
      score += 10;
    }

    return score;
  }

  /**
   * Avalia uma posição (defensiva)
   */
  private evaluateDefensivePosition(
    position: Vector3D,
    ball: BallState,
    opponents: PlayerState[]
  ): number {
    let score = 0;

    // Perto da bola (para pressionar)
    const distToBall = vecDistance(position, ball.position);
    score += (1 - distToBall / 40) * 30;

    // Perto de adversários (para marcar)
    let minDistToOpponent = Infinity;
    for (const opponent of opponents) {
      const dist = vecDistance(position, opponent.position);
      minDistToOpponent = Math.min(minDistToOpponent, dist);
    }
    score += (1 - minDistToOpponent / 15) * 30;

    // Linha defensiva
    if (position.x >= 15 && position.x <= 45) {
      score += 20;
    }

    return score;
  }

  /**
   * Verifica se é posição ofensiva
   */
  private isOffensiveRole(role: PlayerRole): boolean {
    return role === PlayerRole.Striker ||
           role === PlayerRole.StrikerSecond ||
           role === PlayerRole.WingerLeft ||
           role === PlayerRole.WingerRight ||
           role === PlayerRole.MidfielderAttacking;
  }

  /**
   * Verifica se é posição defensiva
   */
  private isDefensiveRole(role: PlayerRole): boolean {
    return role === PlayerRole.DefenderLeft ||
           role === PlayerRole.DefenderCenter ||
           role === PlayerRole.DefenderRight ||
           role === PlayerRole.MidfielderDefensive;
  }

  /**
   * Obtém forma da equipa (distância entre jogadores)
   */
  getTeamShape(teammates: PlayerState[]): {
    compactness: number; // 0-100
    width: number;
    depth: number;
  } {
    if (teammates.length < 2) {
      return { compactness: 0, width: 0, depth: 0 };
    }

    // Calcular centroide
    let centerX = 0;
    let centerY = 0;
    for (const player of teammates) {
      centerX += player.position.x;
      centerY += player.position.y;
    }
    centerX /= teammates.length;
    centerY /= teammates.length;

    // Calcular dispersão
    let totalDist = 0;
    let maxX = -Infinity;
    let minX = Infinity;
    let maxY = -Infinity;
    let minY = Infinity;

    for (const player of teammates) {
      const dist = vecDistance(
        player.position,
        vec3(centerX, centerY, 0)
      );
      totalDist += dist;

      maxX = Math.max(maxX, player.position.x);
      minX = Math.min(minX, player.position.x);
      maxY = Math.max(maxY, player.position.y);
      minY = Math.min(minY, player.position.y);
    }

    const avgDist = totalDist / teammates.length;
    const compactness = Math.max(0, 100 - avgDist * 2);
    const width = maxY - minY;
    const depth = maxX - minX;

    return { compactness, width, depth };
  }
}