import { PlayerState, PlayerRole } from "../core/types/player";
import { BallState } from "../core/types/ball";
import { AIConfig } from "../core/config";
import { Vector3D, vec3, vecDistance, vecLength } from "../core/math/vector3d";
import { PersonalityEngine, ActionType, ActionContext } from "../02_personality_engine/personality-engine";
import { EmotionEngine } from "../03_emotion_engine/emotion-engine";

/**
 * Decision Engine - Utility AI
 *
 * Sistema de tomada de decisões baseado em utilidade:
 * - Avalia múltiplas ações simultaneamente
 * - Personalidade e emoções influenciam avaliação
 * - Não escolhe sempre a melhor ação (variação controlada)
 * - Respeita formação e disciplina tática
 */

export enum DecisionAction {
  PassShort = "PASS_SHORT",
  PassThrough = "PASS_THROUGH",
  PassLob = "PASS_LOB",
  PassOneTouch = "PASS_ONE_TOUCH",
  Shoot = "SHOOT",
  ShootPower = "SHOOT_POWER",
  ShootFinesse = "SHOOT_FINESSE",
  ShootChip = "SHOOT_CHIP",
  Dribble = "DRIBBLE",
  DribbleFeint = "DRIBBLE_FEINT",
  DribbleNutmeg = "DRIBBLE_NUTMEG",
  ProtectBall = "PROTECT_BALL",
  Turn = "TURN",
  FindSpace = "FIND_SPACE",
  WaitMovement = "WAIT_MOVEMENT",
  IndividualPlay = "INDIVIDUAL_PLAY",
  Clear = "CLEAR",
  Header = "HEADER",
  Volley = "VOLLEY",
  Overhead = "OVERHEAD",
}

export interface DecisionOption {
  action: DecisionAction;
  utility: number;
  confidence: number;
  targetPosition: Vector3D;
  targetPlayerId?: number;
  risk: number;
  successProbability: number;
}

export interface DecisionResult {
  selectedAction: DecisionOption;
  allOptions: DecisionOption[];
  decisionTime: number;
}

export class DecisionEngine {
  private config: AIConfig;
  private personalityEngine: PersonalityEngine;
  private emotionEngine: EmotionEngine;

  constructor(
    config: AIConfig,
    personalityEngine: PersonalityEngine,
    emotionEngine: EmotionEngine
  ) {
    this.config = config;
    this.personalityEngine = personalityEngine;
    this.emotionEngine = emotionEngine;
  }

  /**
   * Faz uma decisão baseada na situação atual
   */
  makeDecision(
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[],
    opponents: PlayerState[],
    context: GameContext
  ): DecisionResult {
    const startTime = performance.now();

    // Gerar todas as opções possíveis
    const options = this.generateOptions(player, ball, teammates, opponents, context);

    // Avaliar cada opção
    const evaluatedOptions = options.map((option) =>
      this.evaluateOption(option, player, ball, teammates, opponents, context)
    );

    // Selecionar melhor opção (com variação controlada)
    const selectedAction = this.selectAction(evaluatedOptions, player, context);

    const decisionTime = performance.now() - startTime;

    return {
      selectedAction,
      allOptions: evaluatedOptions,
      decisionTime,
    };
  }

  /**
   * Gera opções de ação baseadas na situação
   */
  private generateOptions(
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[],
    opponents: PlayerState[],
    context: GameContext
  ): DecisionOption[] {
    const options: DecisionOption[] = [];
    const distToGoal = this.getDistanceToGoal(player.position, player.teamId);
    const distToBall = vecDistance(player.position, ball.position);
    const hasBall = player.hasBall;
    const nearbyOpponents = this.getNearbyOpponents(player.position, opponents, 15);
    const nearbyTeammates = this.getNearbyTeammates(player.position, teammates, 25);

    // Se tem a bola
    if (hasBall) {
      // Passe
      for (const teammate of nearbyTeammates) {
        const dist = vecDistance(player.position, teammate.position);
        if (dist < 5) {
          options.push(this.createPassOption(DecisionAction.PassShort, teammate, 0.8));
        } else if (dist < 25) {
          options.push(this.createPassOption(DecisionAction.PassThrough, teammate, 0.6));
          options.push(this.createPassOption(DecisionAction.PassLob, teammate, 0.5));
        }
      }

      // Remate
      if (distToGoal < 35) {
        options.push({
          action: DecisionAction.Shoot,
          utility: 0,
          confidence: 0,
          targetPosition: this.getGoalPosition(player.teamId),
          risk: 0.3,
          successProbability: 0.4,
        });
        options.push({
          action: DecisionAction.ShootPower,
          utility: 0,
          confidence: 0,
          targetPosition: this.getGoalPosition(player.teamId),
          risk: 0.4,
          successProbability: 0.35,
        });
        options.push({
          action: DecisionAction.ShootFinesse,
          utility: 0,
          confidence: 0,
          targetPosition: this.getGoalPosition(player.teamId),
          risk: 0.35,
          successProbability: 0.38,
        });
      }

      // Drible
      if (nearbyOpponents.length > 0) {
        options.push({
          action: DecisionAction.Dribble,
          utility: 0,
          confidence: 0,
          targetPosition: this.predictDribbleTarget(player, opponents),
          risk: 0.5,
          successProbability: 0.5,
        });
        options.push({
          action: DecisionAction.DribbleFeint,
          utility: 0,
          confidence: 0,
          targetPosition: this.predictDribbleTarget(player, opponents),
          risk: 0.6,
          successProbability: 0.45,
        });
      }

      // Proteger bola
      if (nearbyOpponents.length > 0) {
        options.push({
          action: DecisionAction.ProtectBall,
          utility: 0,
          confidence: 0,
          targetPosition: player.position,
          risk: 0.1,
          successProbability: 0.8,
        });
      }

      // Virar
      options.push({
        action: DecisionAction.Turn,
        utility: 0,
        confidence: 0,
        targetPosition: this.predictTurnTarget(player),
        risk: 0.2,
        successProbability: 0.7,
      });

      // Procurar espaço
      options.push({
        action: DecisionAction.FindSpace,
        utility: 0,
        confidence: 0,
        targetPosition: this.findOpenSpace(player, opponents),
        risk: 0.1,
        successProbability: 0.9,
      });

      // Esperar movimento
      options.push({
        action: DecisionAction.WaitMovement,
        utility: 0,
        confidence: 0,
        targetPosition: player.position,
        risk: 0.05,
        successProbability: 0.95,
      });

      // Jogada individual
      if (distToGoal < 25 && nearbyOpponents.length <= 2) {
        options.push({
          action: DecisionAction.IndividualPlay,
          utility: 0,
          confidence: 0,
          targetPosition: this.getGoalPosition(player.teamId),
          risk: 0.7,
          successProbability: 0.3,
        });
      }
    } else {
      // Sem bola - mover para posição
      options.push({
        action: DecisionAction.FindSpace,
        utility: 0,
        confidence: 0,
        targetPosition: this.findOpenSpace(player, opponents),
        risk: 0.1,
        successProbability: 0.9,
      });

      // Interceptar
      if (distToBall < 20) {
        options.push({
          action: DecisionAction.Clear,
          utility: 0,
          confidence: 0,
          targetPosition: ball.position,
          risk: 0.3,
          successProbability: 0.6,
        });
      }
    }

    return options;
  }

  /**
   * Avalia uma opção usando Utility AI
   */
  private evaluateOption(
    option: DecisionOption,
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[],
    opponents: PlayerState[],
    context: GameContext
  ): DecisionOption {
    // Fórmula: UTILITY = BENEFÍCIO_TÁTICO + BENEFÍCIO_INDIVIDUAL + PERSONALIDADE + EMOÇÃO + CONTEXTO + EXPECTATIVA_SUCESSO - RISCO - CUSTO

    let utility = 0;

    // 1. Benefício tático (0-30)
    utility += this.calculateTacticalBenefit(option, player, ball, teammates, opponents, context);

    // 2. Benefício individual (0-20)
    utility += this.calculateIndividualBenefit(option, player, context);

    // 3. Influência da personalidade (0-35) - AUMENTADO
    utility += this.calculatePersonalityInfluence(option, player);

    // 4. Influência emocional (0-15)
    utility += this.calculateEmotionalInfluence(option, player);

    // 5. Contexto do jogo (0-20)
    utility += this.calculateGameContext(option, player, context);

    // 6. Expectativa de sucesso (0-20)
    utility += option.successProbability * 20;

    // 7. Subtrair risco (0-25)
    utility -= option.risk * 25;

    // 8. Subtrair custo (0-10)
    utility -= this.calculateCost(option, player);

    // Normalizar para 0-100
    utility = Math.max(0, Math.min(100, utility));

    return {
      ...option,
      utility,
      confidence: option.successProbability,
    };
  }

  /**
   * Seleciona ação com variação controlada
   */
  private selectAction(
    options: DecisionOption[],
    player: PlayerState,
    context: GameContext
  ): DecisionOption {
    if (options.length === 0) {
      return {
        action: DecisionAction.WaitMovement,
        utility: 0,
        confidence: 0,
        targetPosition: player.position,
        risk: 0,
        successProbability: 0.95,
      };
    }

    // Ordenar por utilidade
    const sorted = [...options].sort((a, b) => b.utility - a.utility);

    // Exploração vs exploração
    const explorationRate = this.config.explorationRate;

    // Com probabilidade explorationRate, escolher ação não-ótima
    if (Math.random() < explorationRate && sorted.length > 1) {
      // Escolher entre top 3 opções
      const topCount = Math.min(3, sorted.length);
      const randomIndex = Math.floor(Math.random() * topCount);
      return sorted[randomIndex];
    }

    // Escolher melhor opção
    return sorted[0];
  }

  // ==================== CÁLCULOS DE UTILIDADE ====================

  private calculateTacticalBenefit(
    option: DecisionOption,
    player: PlayerState,
    ball: BallState,
    teammates: PlayerState[],
    opponents: PlayerState[],
    context: GameContext
  ): number {
    let benefit = 0;

    switch (option.action) {
      case DecisionAction.PassShort:
      case DecisionAction.PassThrough:
      case DecisionAction.PassLob:
      case DecisionAction.PassOneTouch:
        // Passe beneficia posse de bola
        benefit = 18;
        if (context.hasPossession) benefit += 7;
        if (teammates.length > 0) benefit += 5;
        break;

      case DecisionAction.Shoot:
      case DecisionAction.ShootPower:
      case DecisionAction.ShootFinesse:
      case DecisionAction.ShootChip:
        // Remate beneficia ataque - penaliza mais a distância
        // (remates de longe são maus investimentos: preferir progredir/passar)
        const distToGoal = this.getDistanceToGoal(player.position, player.teamId);
        benefit = 15 - distToGoal * 0.3;
        if (context.isInOpponentHalf) benefit += 5;
        break;

      case DecisionAction.Dribble:
      case DecisionAction.DribbleFeint:
      case DecisionAction.DribbleNutmeg:
        // Drible beneficia progressão
        benefit = 10;
        if (opponents.length > 0) benefit += 5;
        break;

      case DecisionAction.ProtectBall:
        // Proteger beneficia sob pressão
        benefit = 15;
        if (opponents.length > 1) benefit += 10;
        break;

      case DecisionAction.FindSpace:
        // Espaço beneficia movimento
        benefit = 12;
        if (!context.hasPossession) benefit += 8;
        break;

      case DecisionAction.Clear:
        // Limpar beneficia defesa
        benefit = 18;
        if (context.isInOwnHalf) benefit += 7;
        break;
    }

    return Math.max(0, Math.min(30, benefit));
  }

  private calculateIndividualBenefit(
    option: DecisionOption,
    player: PlayerState,
    context: GameContext
  ): number {
    let benefit = 0;

    // Passe beneficia jogadores cooperativos (baixo egoísmo + alta cooperação):
    // um médio criativo serve; um extremo egoísta prefere resolução individual
    const isPassAction = [
      DecisionAction.PassShort,
      DecisionAction.PassThrough,
      DecisionAction.PassLob,
      DecisionAction.PassOneTouch,
    ].includes(option.action);

    if (isPassAction) {
      benefit =
        (100 - player.personality.egoism) * 0.08 +
        player.personality.cooperation * 0.06;
      return Math.max(0, Math.min(20, benefit));
    }

    // Ações individuais beneficiam jogadores ambiciosos
    const isIndividualAction = [
      DecisionAction.Shoot,
      DecisionAction.ShootPower,
      DecisionAction.ShootFinesse,
      DecisionAction.Dribble,
      DecisionAction.DribbleFeint,
      DecisionAction.IndividualPlay,
    ].includes(option.action);

    if (isIndividualAction) {
      benefit = 15;
      if (player.role === PlayerRole.Striker) benefit += 5;
      if (player.role === PlayerRole.MidfielderAttacking) benefit += 3;
    }

    return Math.max(0, Math.min(20, benefit));
  }

  private calculatePersonalityInfluence(
    option: DecisionOption,
    player: PlayerState
  ): number {
    const actionType = this.mapToActionType(option.action);
    const context: ActionContext = {
      hasSpace: option.successProbability > 0.6,
      isUnderPressure: option.risk > 0.5,
      isNearGoal: this.getDistanceToGoal(player.position, player.teamId) < 25,
      hasOpenTeammate: option.action.toString().includes("PASS"),
    };

    const adjustment = this.personalityEngine.evaluateActionFit(player, actionType, context);
    // Aumentar influência da personalidade (escala de -17.5 a 17.5)
    return Math.max(0, Math.min(35, adjustment * 1.4 + 17.5));
  }

  private calculateEmotionalInfluence(
    option: DecisionOption,
    player: PlayerState
  ): number {
    const influence = this.emotionEngine.getEmotionalInfluence(player.id);

    let modifier = 0;

    // Risco afeta ações arriscadas
    if (option.risk > 0.5) {
      modifier += influence.riskModifier * 10;
    }

    // Confiança afeta todas as ações
    modifier += influence.confidenceModifier * 5;

    // Criatividade afeta ações criativas
    if (option.action.toString().includes("FEINT") ||
        option.action.toString().includes("NUTMEG") ||
        option.action === DecisionAction.IndividualPlay) {
      modifier += influence.creativityModifier * 10;
    }

    return Math.max(0, Math.min(15, modifier + 7.5));
  }

  private calculateGameContext(
    option: DecisionOption,
    player: PlayerState,
    context: GameContext
  ): number {
    let bonus = 0;
    const action = option.action;

    // Placar influencia decisão
    if (context.isWinning && context.goalDifference >= 2) {
      // Com vantagem, pode arriscar mais
      if (action.toString().includes("DRIBBLE") || action === DecisionAction.IndividualPlay) {
        bonus += 5;
      }
    } else if (context.isLosing) {
      // Perdendo, precisa de resultados
      if (action.toString().includes("SHOOT") || action.toString().includes("PASS_THROUGH")) {
        bonus += 8;
      }
    }

    // Tempo restante
    if (context.minutesRemaining < 5 && context.isLosing) {
      // Últimos minutos, precisa de golos
      if (action.toString().includes("SHOOT")) bonus += 10;
    }

    return Math.max(0, Math.min(20, bonus));
  }

  private calculateCost(
    option: DecisionOption,
    player: PlayerState
  ): number {
    let cost = 0;

    // Ações que demoram têm custo
    if (option.action === DecisionAction.IndividualPlay) cost += 5;
    if (option.action === DecisionAction.DribbleFeint) cost += 3;

    // Custo de energia (simplificado)
    if (player.stamina < 30) cost += 3;

    return Math.max(0, Math.min(10, cost));
  }

  // ==================== MÉTODOS AUXILIARES ====================

  private createPassOption(
    action: DecisionAction,
    teammate: PlayerState,
    successProbability: number
  ): DecisionOption {
    return {
      action,
      utility: 0,
      confidence: 0,
      targetPosition: teammate.position,
      targetPlayerId: teammate.id,
      risk: 0.2,
      successProbability,
    };
  }

  private getDistanceToGoal(position: Vector3D, teamId: number): number {
    // Simplificado: baliza em x=100 para time 1, x=0 para time 2
    const goalX = teamId === 1 ? 100 : 0;
    const goalY = 32.5;
    return vecDistance(position, vec3(goalX, goalY, 0));
  }

  private getGoalPosition(teamId: number): Vector3D {
    const goalX = teamId === 1 ? 100 : 0;
    return vec3(goalX, 32.5, 0);
  }

  private getNearbyOpponents(
    position: Vector3D,
    opponents: PlayerState[],
    radius: number
  ): PlayerState[] {
    return opponents.filter((opp) => vecDistance(position, opp.position) < radius);
  }

  private getNearbyTeammates(
    position: Vector3D,
    teammates: PlayerState[],
    radius: number
  ): PlayerState[] {
    return teammates.filter((tm) => vecDistance(position, tm.position) < radius);
  }

  private predictDribbleTarget(
    player: PlayerState,
    opponents: PlayerState[]
  ): Vector3D {
    // Simplificado: avançar na direção do gol
    const goalPos = this.getGoalPosition(player.teamId);
    const direction = vec3(
      goalPos.x - player.position.x,
      goalPos.y - player.position.y,
      0
    );
    const dist = vecLength(direction);
    if (dist < 0.001) return player.position;

    const normalized = vec3(
      direction.x / dist,
      direction.y / dist,
      0
    );

    return vec3(
      player.position.x + normalized.x * 5,
      player.position.y + normalized.y * 5,
      0
    );
  }

  private predictTurnTarget(player: PlayerState): Vector3D {
    // Virar para trás (simplificado)
    return vec3(
      player.position.x - 3,
      player.position.y,
      0
    );
  }

  private findOpenSpace(
    player: PlayerState,
    opponents: PlayerState[]
  ): Vector3D {
    // Encontrar espaço aberto (simplificado)
    const centerField = vec3(50, 32.5, 0);
    const direction = vec3(
      centerField.x - player.position.x,
      centerField.y - player.position.y,
      0
    );
    const dist = vecLength(direction);
    if (dist < 0.001) return player.position;

    return vec3(
      player.position.x + (direction.x / dist) * 10,
      player.position.y + (direction.y / dist) * 10,
      0
    );
  }

  private mapToActionType(action: DecisionAction): ActionType {
    switch (action) {
      case DecisionAction.PassShort:
      case DecisionAction.PassThrough:
      case DecisionAction.PassLob:
      case DecisionAction.PassOneTouch:
        return ActionType.Pass;
      case DecisionAction.Shoot:
      case DecisionAction.ShootPower:
      case DecisionAction.ShootFinesse:
      case DecisionAction.ShootChip:
        return ActionType.Shoot;
      case DecisionAction.Dribble:
      case DecisionAction.DribbleFeint:
      case DecisionAction.DribbleNutmeg:
        return ActionType.Dribble;
      case DecisionAction.ProtectBall:
      case DecisionAction.Turn:
        return ActionType.Defend;
      case DecisionAction.FindSpace:
      case DecisionAction.WaitMovement:
        return ActionType.Position;
      default:
        return ActionType.Support;
    }
  }
}

// ==================== TIPOS AUXILIARES ====================

export interface GameContext {
  hasPossession: boolean;
  isInOpponentHalf: boolean;
  isInOwnHalf: boolean;
  isWinning: boolean;
  isLosing: boolean;
  goalDifference: number;
  minutesRemaining: number;
}