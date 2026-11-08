import { PlayerState, PlayerRole } from "../core/types/player";
import { GameEventType } from "../core/types/game-event";
import { Vector3D, vecDistance } from "../core/math/vector3d";
import { AIConfig } from "../core/config";
import { MemoryEngine, MemoryEvent } from "../06_memory_engine/memory-engine";

/**
 * Learning Engine
 *
 * Sistema de aprendizagem e evolução:
 * - Aprendizagem através dos erros
 * - Aprendizagem através dos adversários
 * - Reconhecimento de padrões
 * - Adaptação comportamental
 * - Evolução ao longo do tempo
 */

export interface ErrorAnalysis {
  errorType: string;
  count: number;
  lastOccurrence: number;
  pattern: string;
  suggestedAdjustment: number; // -1 a 1
}

export interface OpponentPattern {
  opponentId: number;
  tendency: string;
  frequency: number; // 0-1
  lastSeen: number;
  counterStrategy: string;
}

export interface LearningAdjustment {
  attribute: string;
  adjustment: number; // -1 a 1
  reason: string;
  confidence: number; // 0-1
}

export class LearningEngine {
  private config: AIConfig;
  private memoryEngine: MemoryEngine;

  // Análise de erros por jogador
  private errorAnalysis: Map<number, ErrorAnalysis[]> = new Map();

  // Padrões de adversários
  private opponentPatterns: Map<number, OpponentPattern[]> = new Map();

  // Ajustes de aprendizagem
  private learningAdjustments: Map<number, LearningAdjustment[]> = new Map();

  // Taxa de aprendizagem por jogador
  private learningRates: Map<number, number> = new Map();

  constructor(config: AIConfig, memoryEngine: MemoryEngine) {
    this.config = config;
    this.memoryEngine = memoryEngine;
    this.initializeDefaultLearningRates();
  }

  /**
   * Analisa um erro e gera ajuste
   */
  analyzeError(
    player: PlayerState,
    event: MemoryEvent,
    context: ErrorContext
  ): LearningAdjustment | null {
    const playerId = player.id;

    // Inicializar se necessário
    if (!this.errorAnalysis.has(playerId)) {
      this.errorAnalysis.set(playerId, []);
    }
    if (!this.learningAdjustments.has(playerId)) {
      this.learningAdjustments.set(playerId, []);
    }

    // Identificar tipo de erro
    const errorType = this.identifyErrorType(event, context);

    // Registrar erro
    this.recordError(playerId, errorType, event.timestamp);

    // Gerar ajuste baseado no erro
    const adjustment = this.generateAdjustment(player, errorType, context);

    if (adjustment) {
      this.learningAdjustments.get(playerId)!.push(adjustment);
    }

    return adjustment;
  }

  /**
   * Analisa padrão de adversário
   */
  analyzeOpponentPattern(
    playerId: number,
    opponentId: number,
    events: MemoryEvent[]
  ): OpponentPattern | null {
    if (events.length < 3) return null; // Precisa de mais dados

    // Inicializar se necessário
    if (!this.opponentPatterns.has(playerId)) {
      this.opponentPatterns.set(playerId, []);
    }

    // Identificar tendência
    const tendency = this.identifyTendency(events);
    if (!tendency) return null;

    // Calcular frequência
    const frequency = this.calculateFrequency(events, tendency);

    // Criar padrão
    const pattern: OpponentPattern = {
      opponentId,
      tendency,
      frequency,
      lastSeen: Date.now(),
      counterStrategy: this.suggestCounterStrategy(tendency),
    };

    // Adicionar ou atualizar
    const patterns = this.opponentPatterns.get(playerId)!;
    const existingIndex = patterns.findIndex(
      (p) => p.opponentId === opponentId && p.tendency === tendency
    );

    if (existingIndex >= 0) {
      patterns[existingIndex] = pattern;
    } else {
      patterns.push(pattern);
    }

    return pattern;
  }

  /**
   * Obtém ajustes de aprendizagem ativos
   */
  getLearningAdjustments(playerId: number): LearningAdjustment[] {
    return this.learningAdjustments.get(playerId) || [];
  }

  /**
   * Obtém padrões de adversário
   */
  getOpponentPatterns(playerId: number): OpponentPattern[] {
    return this.opponentPatterns.get(playerId) || [];
  }

  /**
   * Obtém padrões para adversário específico
   */
  getPatternsForOpponent(playerId: number, opponentId: number): OpponentPattern[] {
    const patterns = this.getOpponentPatterns(playerId);
    return patterns.filter((p) => p.opponentId === opponentId);
  }

  /**
   * Obtém análise de erros
   */
  getErrorAnalysis(playerId: number): ErrorAnalysis[] {
    return this.errorAnalysis.get(playerId) || [];
  }

  /**
   * Aplica ajustes de aprendizagem a um jogador
   */
  applyLearning(player: PlayerState): PlayerState {
    const adjustments = this.getLearningAdjustments(player.id);
    const learningRate = this.getLearningRate(player.id);

    for (const adjustment of adjustments) {
      const scaledAdjustment = adjustment.adjustment * learningRate * adjustment.confidence;
      this.applyAttributeAdjustment(player, adjustment.attribute, scaledAdjustment);
    }

    return player;
  }

  /**
   * Obtém taxa de aprendizagem de um jogador
   */
  getLearningRate(playerId: number): number {
    return this.learningRates.get(playerId) || this.config.learningRate;
  }

  /**
   * Define taxa de aprendizagem
   */
  setLearningRate(playerId: number, rate: number): void {
    this.learningRates.set(playerId, Math.max(0, Math.min(1, rate)));
  }

  /**
   * Inicializa taxas de aprendizagem baseadas na personalidade
   */
  private initializeDefaultLearningRates(): void {
    // Será chamado quando jogador for criado
  }

  /**
   * Inicializa taxa de aprendizagem para um jogador
   */
  initPlayerLearningRate(player: PlayerState): void {
    const baseRate = this.config.learningRate;

    // Jogadores com inteligência tática aprendem mais
    let rate = baseRate;
    rate *= 1 + (player.mental.decisions / 100) * 0.5;
    rate *= 1 + (player.personality.adaptability / 100) * 0.3;
    rate *= 1 + (player.mental.concentration / 100) * 0.2;

    this.learningRates.set(player.id, Math.min(rate, 0.1)); // Max 0.1
  }

  /**
   * Identifica tipo de erro
   */
  private identifyErrorType(event: MemoryEvent, context: ErrorContext): string {
    switch (event.type) {
      case GameEventType.PassIncomplete:
        return context.isUnderPressure ? "pass_under_pressure" : "pass_inaccurate";
      case GameEventType.ShotOffTarget:
        return "shot_off_target";
      case GameEventType.DribbleLost:
        return "dribble_failed";
      case GameEventType.TackleLost:
        return "tackle_failed";
      case GameEventType.Interception:
        return "interception_missed";
      default:
        return "generic_error";
    }
  }

  /**
   * Regista erro
   */
  private recordError(playerId: number, errorType: string, timestamp: number): void {
    const analysis = this.errorAnalysis.get(playerId)!;
    const existing = analysis.find((a) => a.errorType === errorType);

    if (existing) {
      existing.count++;
      existing.lastOccurrence = timestamp;
    } else {
      analysis.push({
        errorType,
        count: 1,
        lastOccurrence: timestamp,
        pattern: "",
        suggestedAdjustment: 0,
      });
    }
  }

  /**
   * Gera ajuste baseado no erro
   */
  private generateAdjustment(
    player: PlayerState,
    errorType: string,
    context: ErrorContext
  ): LearningAdjustment | null {
    const learningRate = this.getLearningRate(player.id);

    switch (errorType) {
      case "pass_under_pressure":
        return {
          attribute: "composure",
          adjustment: 0.1,
          reason: "Melhorar sob pressão",
          confidence: 0.7,
        };

      case "pass_inaccurate":
        return {
          attribute: "passing",
          adjustment: 0.05,
          reason: "Melhorar precisão de passe",
          confidence: 0.6,
        };

      case "shot_off_target":
        return {
          attribute: "shooting",
          adjustment: 0.08,
          reason: "Melhorar finalização",
          confidence: 0.65,
        };

      case "dribble_failed":
        if (context.distanceToOpponent < 3) {
          return {
            attribute: "dribbling",
            adjustment: 0.07,
            reason: "Melhorar drible próximo",
            confidence: 0.6,
          };
        }
        return null;

      case "tackle_failed":
        return {
          attribute: "tackling",
          adjustment: 0.06,
          reason: "Melhorar desarme",
          confidence: 0.55,
        };

      default:
        return null;
    }
  }

  /**
   * Identifica tendência de adversário
   */
  private identifyTendency(events: MemoryEvent[]): string | null {
    // Contar tipos de eventos
    const typeCounts = new Map<GameEventType, number>();
    for (const event of events) {
      typeCounts.set(event.type, (typeCounts.get(event.type) || 0) + 1);
    }

    // Encontrar tipo mais comum
    let maxCount = 0;
    let mostCommon: GameEventType | null = null;
    for (const [type, count] of typeCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = type;
      }
    }

    if (!mostCommon || maxCount < 3) return null;

    // Mapear para tendência
    const tendencyMap: Record<string, string> = {
      [GameEventType.PassComplete]: "prefers_passing",
      [GameEventType.DribbleWon]: "prefers_dribbling",
      [GameEventType.ShotOnTarget]: "aggressive_shooting",
      [GameEventType.TackleWon]: "aggressive_defending",
    };

    return tendencyMap[mostCommon] || null;
  }

  /**
   * Calcula frequência de uma tendência
   */
  private calculateFrequency(events: MemoryEvent[], tendency: string): number {
    const tendencyMap: Record<string, GameEventType> = {
      prefers_passing: GameEventType.PassComplete,
      prefers_dribbling: GameEventType.DribbleWon,
      aggressive_shooting: GameEventType.ShotOnTarget,
      aggressive_defending: GameEventType.TackleWon,
    };

    const eventType = tendencyMap[tendency];
    if (!eventType) return 0;

    const matchingEvents = events.filter((e) => e.type === eventType);
    return matchingEvents.length / events.length;
  }

  /**
   * Sugere estratégia contra
   */
  private suggestCounterStrategy(tendency: string): string {
    const strategies: Record<string, string> = {
      prefers_passing: "Pressionar linhas de passe",
      prefers_dribbling: "Defender com distância, evitar carrinho",
      aggressive_shooting: "Bloquear ângulos de remate",
      aggressive_defending: "Usar velocidade para ultrapassar",
    };

    return strategies[tendency] || "Observar e adaptar";
  }

  /**
   * Aplica ajuste a atributo
   */
  private applyAttributeAdjustment(
    player: PlayerState,
    attribute: string,
    adjustment: number
  ): void {
    switch (attribute) {
      case "composure":
        player.mental.composure = Math.max(0, Math.min(100, player.mental.composure + adjustment));
        break;
      case "passing":
        player.technical.passing = Math.max(0, Math.min(100, player.technical.passing + adjustment));
        break;
      case "shooting":
        player.technical.shooting = Math.max(0, Math.min(100, player.technical.shooting + adjustment));
        break;
      case "dribbling":
        player.technical.dribbling = Math.max(0, Math.min(100, player.technical.dribbling + adjustment));
        break;
      case "tackling":
        player.technical.tackling = Math.max(0, Math.min(100, player.technical.tackling + adjustment));
        break;
      case "anticipation":
        player.mental.anticipation = Math.max(0, Math.min(100, player.mental.anticipation + adjustment));
        break;
    }
  }
}

// ==================== TIPOS AUXILIARES ====================

export interface ErrorContext {
  isUnderPressure: boolean;
  distanceToOpponent: number;
  distanceToGoal: number;
  hasOpenTeammate: boolean;
  timeAvailable: number;
}