import { PlayerState, EmotionalState, createDefaultEmotions } from "../core/types/player";
import { GameEventType } from "../core/types/game-event";
import { AIConfig } from "../core/config";

/**
 * Emotion Engine
 *
 * Sistema emocional dinâmico:
 * - Emoções mudam durante a partida baseado em eventos
 * - Personalidade afeta COMO o jogador reage emocionalmente
 * - Dois jogadores reagem diferente ao mesmo evento
 * - Emoções decaem com o tempo
 * - Emoções influenciam decisões mas não sobrepõem personalidade
 */

export interface EmotionalReaction {
  anger: number;
  confidence: number;
  fear: number;
  frustration: number;
  euphoria: number;
  pride: number;
  anxiety: number;
  motivation: number;
  envy: number;
  determination: number;
}

export interface EmotionEvent {
  type: GameEventType;
  playerId: number;
  targetPlayerId?: number;
  success: boolean;
  importance: number; // 0-1
}

export class EmotionEngine {
  private config: AIConfig;
  private playerEmotions: Map<number, EmotionalState> = new Map();

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * Inicializa emoções para um jogador
   */
  initPlayer(playerId: number): void {
    if (!this.playerEmotions.has(playerId)) {
      this.playerEmotions.set(playerId, createDefaultEmotions());
    }
  }

  /**
   * Obtém emoções atuais de um jogador
   */
  getEmotions(playerId: number): EmotionalState {
    this.initPlayer(playerId);
    return this.playerEmotions.get(playerId)!;
  }

  /**
   * Processa um evento emocional
   */
  processEvent(player: PlayerState, event: EmotionEvent): EmotionalReaction {
    const emotions = this.getEmotions(player.id);
    const personality = player.personality;

    let reaction: EmotionalReaction;

    switch (event.type) {
      case GameEventType.Goal:
        reaction = this.reactToGoal(player, event.success);
        break;
      case GameEventType.ShotOnTarget:
        reaction = this.reactToShot(player, event.success);
        break;
      case GameEventType.ShotOffTarget:
        reaction = this.reactToMissedShot(player);
        break;
      case GameEventType.PassComplete:
        reaction = this.reactToPass(player, event.success);
        break;
      case GameEventType.PassIncomplete:
        reaction = this.reactToFailedPass(player);
        break;
      case GameEventType.TackleWon:
        reaction = this.reactToTackle(player, event.success);
        break;
      case GameEventType.TackleLost:
        reaction = this.reactToFailedTackle(player);
        break;
      case GameEventType.Interception:
        reaction = this.reactToInterception(player, event.success);
        break;
      case GameEventType.DribbleWon:
        reaction = this.reactToDribble(player, event.success);
        break;
      case GameEventType.DribbleLost:
        reaction = this.reactToFailedDribble(player);
        break;
      case GameEventType.Foul:
        reaction = this.reactToFoul(player, event.success);
        break;
      case GameEventType.YellowCard:
        reaction = this.reactToYellowCard(player);
        break;
      case GameEventType.RedCard:
        reaction = this.reactToRedCard(player);
        break;
      case GameEventType.Saving:
        reaction = this.reactToSave(player, event.success);
        break;
      default:
        reaction = this.reactToNeutralEvent();
        break;
    }

    // Aplicar modificadores de personalidade
    reaction = this.applyPersonalityModifiers(reaction, personality);

    // Aplicar importância do evento
    reaction = this.applyImportance(reaction, event.importance);

    // Atualizar emoções
    this.updateEmotions(emotions, reaction);

    return reaction;
  }

  /**
   * Decaimento de emoções ao longo do tempo
   */
  decayEmotions(playerId: number, deltaTime: number): void {
    const emotions = this.getEmotions(playerId);
    const decayRate = this.config.memoryDecayRate;

    // Emoções negativas decaem mais rápido
    emotions.anger *= Math.pow(decayRate, deltaTime);
    emotions.fear *= Math.pow(decayRate, deltaTime);
    emotions.frustration *= Math.pow(decayRate, deltaTime);
    emotions.anxiety *= Math.pow(decayRate, deltaTime);
    emotions.envy *= Math.pow(decayRate, deltaTime);

    // Emoções positivas decaem mais lentamente
    emotions.euphoria *= Math.pow(0.98, deltaTime);
    emotions.pride *= Math.pow(0.99, deltaTime);
    emotions.motivation *= Math.pow(0.99, deltaTime);
    emotions.determination *= Math.pow(0.99, deltaTime);

    // Confiança volta ao equilíbrio lentamente
    const equilibrium = 50;
    emotions.confidence += (equilibrium - emotions.confidence) * 0.01 * deltaTime;

    // Garantir limites
    this.clampEmotions(emotions);
  }

  /**
   * Obtém influência emocional em uma ação
   */
  getEmotionalInfluence(playerId: number): {
    riskModifier: number;
    aggressionModifier: number;
    confidenceModifier: number;
    creativityModifier: number;
  } {
    const emotions = this.getEmotions(playerId);

    return {
      riskModifier: this.calculateRiskModifier(emotions),
      aggressionModifier: this.calculateAggressionModifier(emotions),
      confidenceModifier: this.calculateConfidenceModifier(emotions),
      creativityModifier: this.calculateCreativityModifier(emotions),
    };
  }

  /**
   * Obtém descrição textual do estado emocional
   */
  getEmotionalStateDescription(playerId: number): string {
    const emotions = this.getEmotions(playerId);
    const descriptions: string[] = [];

    if (emotions.anger > 70) descriptions.push("raivoso");
    if (emotions.confidence > 75) descriptions.push("confiante");
    if (emotions.confidence < 30) descriptions.push("inseguro");
    if (emotions.fear > 60) descriptions.push("assustado");
    if (emotions.frustration > 65) descriptions.push("frustrado");
    if (emotions.euphoria > 70) descriptions.push("eufórico");
    if (emotions.pride > 70) descriptions.push("orgulhoso");
    if (emotions.anxiety > 60) descriptions.push("ansioso");
    if (emotions.motivation > 75) descriptions.push("motivado");
    if (emotions.determination > 75) descriptions.push("determinado");
    if (emotions.envy > 60) descriptions.push("invejoso");

    if (descriptions.length === 0) return "neutro";
    return descriptions.join(", ");
  }

  // ==================== REAÇÕES A EVENTOS ====================

  private reactToGoal(player: PlayerState, success: boolean): EmotionalReaction {
    const personality = player.personality;
    const base: EmotionalReaction = {
      anger: 0, confidence: 0, fear: 0, frustration: 0,
      euphoria: 0, pride: 0, anxiety: 0, motivation: 0,
      envy: 0, determination: 0,
    };

    if (success) {
      base.euphoria = 30 + personality.ambition * 0.3;
      base.confidence = 25 + personality.confidence * 0.2;
      base.pride = 20 + personality.pride * 0.25;
      base.motivation = 15 + personality.competitiveness * 0.15;
    }

    return base;
  }

  private reactToShot(player: PlayerState, success: boolean): EmotionalReaction {
    const personality = player.personality;
    const base: EmotionalReaction = {
      anger: 0, confidence: 0, fear: 0, frustration: 0,
      euphoria: 0, pride: 0, anxiety: 0, motivation: 0,
      envy: 0, determination: 0,
    };

    if (success) {
      base.confidence = 15 + personality.confidence * 0.15;
      base.motivation = 10;
    } else {
      base.frustration = 10 + personality.impulsiveness * 0.1;
      base.determination = 8 + personality.persistence * 0.1;
    }

    return base;
  }

  private reactToMissedShot(player: PlayerState): EmotionalReaction {
    const personality = player.personality;
    return {
      anger: 5 + personality.impulsiveness * 0.1,
      confidence: -10 - personality.confidence * 0.1,
      fear: 0,
      frustration: 15 + personality.ambition * 0.15,
      euphoria: 0,
      pride: -5,
      anxiety: 5,
      motivation: 5 + personality.persistence * 0.1,
      envy: 0,
      determination: 10 + personality.persistence * 0.1,
    };
  }

  private reactToPass(player: PlayerState, success: boolean): EmotionalReaction {
    const personality = player.personality;
    const base: EmotionalReaction = {
      anger: 0, confidence: 0, fear: 0, frustration: 0,
      euphoria: 0, pride: 0, anxiety: 0, motivation: 0,
      envy: 0, determination: 0,
    };

    if (success) {
      base.confidence = 5 + personality.confidence * 0.05;
    } else {
      base.frustration = 5 + personality.impulsiveness * 0.05;
    }

    return base;
  }

  private reactToFailedPass(player: PlayerState): EmotionalReaction {
    const personality = player.personality;
    return {
      anger: 3 + personality.impulsiveness * 0.05,
      confidence: -5,
      fear: 0,
      frustration: 8 + personality.ambition * 0.08,
      euphoria: 0,
      pride: -3,
      anxiety: 3,
      motivation: 3,
      envy: 0,
      determination: 5 + personality.persistence * 0.05,
    };
  }

  private reactToTackle(player: PlayerState, success: boolean): EmotionalReaction {
    const personality = player.personality;
    const base: EmotionalReaction = {
      anger: 0, confidence: 0, fear: 0, frustration: 0,
      euphoria: 0, pride: 0, anxiety: 0, motivation: 0,
      envy: 0, determination: 0,
    };

    if (success) {
      base.confidence = 10 + personality.aggressiveness * 0.1;
      base.pride = 8 + personality.pride * 0.08;
      base.determination = 5;
    } else {
      base.frustration = 8 + personality.competitiveness * 0.08;
      base.anger = 5 + personality.aggressiveness * 0.05;
    }

    return base;
  }

  private reactToFailedTackle(player: PlayerState): EmotionalReaction {
    const personality = player.personality;
    return {
      anger: 8 + personality.aggressiveness * 0.1,
      confidence: -8,
      fear: 3,
      frustration: 12 + personality.competitiveness * 0.12,
      euphoria: 0,
      pride: -8,
      anxiety: 5,
      motivation: 3,
      envy: 0,
      determination: 5,
    };
  }

  private reactToInterception(player: PlayerState, success: boolean): EmotionalReaction {
    const personality = player.personality;
    const base: EmotionalReaction = {
      anger: 0, confidence: 0, fear: 0, frustration: 0,
      euphoria: 0, pride: 0, anxiety: 0, motivation: 0,
      envy: 0, determination: 0,
    };

    if (success) {
      base.confidence = 12 + personality.competitiveness * 0.1;
      base.pride = 10 + personality.pride * 0.1;
    } else {
      base.frustration = 8;
    }

    return base;
  }

  private reactToDribble(player: PlayerState, success: boolean): EmotionalReaction {
    const personality = player.personality;
    const base: EmotionalReaction = {
      anger: 0, confidence: 0, fear: 0, frustration: 0,
      euphoria: 0, pride: 0, anxiety: 0, motivation: 0,
      envy: 0, determination: 0,
    };

    if (success) {
      base.confidence = 15 + personality.creativity * 0.15;
      base.euphoria = 10 + personality.vanity * 0.1;
      base.pride = 12 + personality.pride * 0.12;
    } else {
      base.frustration = 12 + personality.ambition * 0.12;
      base.anger = 5 + personality.impulsiveness * 0.05;
    }

    return base;
  }

  private reactToFailedDribble(player: PlayerState): EmotionalReaction {
    const personality = player.personality;
    return {
      anger: 10 + personality.impulsiveness * 0.1,
      confidence: -12,
      fear: 5,
      frustration: 18 + personality.ambition * 0.18,
      euphoria: 0,
      pride: -15,
      anxiety: 8,
      motivation: 5,
      envy: 0,
      determination: 8 + personality.persistence * 0.08,
    };
  }

  private reactToFoul(player: PlayerState, success: boolean): EmotionalReaction {
    const personality = player.personality;
    const base: EmotionalReaction = {
      anger: 0, confidence: 0, fear: 0, frustration: 0,
      euphoria: 0, pride: 0, anxiety: 0, motivation: 0,
      envy: 0, determination: 0,
    };

    if (success) {
      base.anger = 5 + personality.aggressiveness * 0.05;
    } else {
      base.frustration = 10 + personality.competitiveness * 0.1;
      base.anger = 8 + personality.aggressiveness * 0.08;
    }

    return base;
  }

  private reactToYellowCard(player: PlayerState): EmotionalReaction {
    const personality = player.personality;
    return {
      anger: 15 + personality.aggressiveness * 0.15,
      confidence: -10,
      fear: 10,
      frustration: 15 + personality.competitiveness * 0.1,
      euphoria: 0,
      pride: -10,
      anxiety: 15,
      motivation: 5,
      envy: 0,
      determination: 5,
    };
  }

  private reactToRedCard(player: PlayerState): EmotionalReaction {
    const personality = player.personality;
    return {
      anger: 30 + personality.aggressiveness * 0.2,
      confidence: -30,
      fear: 20,
      frustration: 35 + personality.competitiveness * 0.2,
      euphoria: 0,
      pride: -30,
      anxiety: 30,
      motivation: -10,
      envy: 0,
      determination: -15,
    };
  }

  private reactToSave(player: PlayerState, success: boolean): EmotionalReaction {
    const personality = player.personality;
    const base: EmotionalReaction = {
      anger: 0, confidence: 0, fear: 0, frustration: 0,
      euphoria: 0, pride: 0, anxiety: 0, motivation: 0,
      envy: 0, determination: 0,
    };

    if (success) {
      base.confidence = 20 + personality.confidence * 0.2;
      base.pride = 15 + personality.pride * 0.15;
      base.euphoria = 12;
    } else {
      base.frustration = 15 + personality.ambition * 0.15;
      base.confidence = -15;
    }

    return base;
  }

  private reactToNeutralEvent(): EmotionalReaction {
    return {
      anger: 0, confidence: 0, fear: 0, frustration: 0,
      euphoria: 0, pride: 0, anxiety: 0, motivation: 0,
      envy: 0, determination: 0,
    };
  }

  // ==================== MODIFICADORES ====================

  private applyPersonalityModifiers(
    reaction: EmotionalReaction,
    personality: PlayerState["personality"]
  ): EmotionalReaction {
    const modified = { ...reaction };

    // Jogadores impulsivos reagem mais forte
    const impulsivenessFactor = personality.impulsiveness / 100;
    modified.anger *= 1 + impulsivenessFactor * 0.5;
    modified.frustration *= 1 + impulsivenessFactor * 0.3;

    // Jogadores com frieza (composure) reagem menos
    const composureFactor = personality.composure / 100;
    modified.anger *= 1 - composureFactor * 0.3;
    modified.fear *= 1 - composureFactor * 0.4;
    modified.anxiety *= 1 - composureFactor * 0.3;

    // Jogadores competitivos sentem mais frustração
    const competitivenessFactor = personality.competitiveness / 100;
    modified.frustration *= 1 + competitivenessFactor * 0.3;

    // Jogadores orgulhosos sentem mais orgulho/pride
    const prideFactor = personality.pride / 100;
    modified.pride *= 1 + prideFactor * 0.4;

    // Jogadores ambiciosos sentem mais motivação
    const ambitionFactor = personality.ambition / 100;
    modified.motivation *= 1 + ambitionFactor * 0.3;
    modified.determination *= 1 + ambitionFactor * 0.2;

    return modified;
  }

  private applyImportance(
    reaction: EmotionalReaction,
    importance: number
  ): EmotionalReaction {
    const modified = { ...reaction };
    const factor = 0.5 + importance * 0.5; // 0.5 a 1.0

    modified.anger *= factor;
    modified.confidence *= factor;
    modified.fear *= factor;
    modified.frustration *= factor;
    modified.euphoria *= factor;
    modified.pride *= factor;
    modified.anxiety *= factor;
    modified.motivation *= factor;
    modified.envy *= factor;
    modified.determination *= factor;

    return modified;
  }

  private updateEmotions(emotions: EmotionalState, reaction: EmotionalReaction): void {
    emotions.anger = Math.max(0, Math.min(100, emotions.anger + reaction.anger));
    emotions.confidence = Math.max(0, Math.min(100, emotions.confidence + reaction.confidence));
    emotions.fear = Math.max(0, Math.min(100, emotions.fear + reaction.fear));
    emotions.frustration = Math.max(0, Math.min(100, emotions.frustration + reaction.frustration));
    emotions.euphoria = Math.max(0, Math.min(100, emotions.euphoria + reaction.euphoria));
    emotions.pride = Math.max(0, Math.min(100, emotions.pride + reaction.pride));
    emotions.anxiety = Math.max(0, Math.min(100, emotions.anxiety + reaction.anxiety));
    emotions.motivation = Math.max(0, Math.min(100, emotions.motivation + reaction.motivation));
    emotions.envy = Math.max(0, Math.min(100, emotions.envy + reaction.envy));
    emotions.determination = Math.max(0, Math.min(100, emotions.determination + reaction.determination));
  }

  private clampEmotions(emotions: EmotionalState): void {
    emotions.anger = Math.max(0, Math.min(100, emotions.anger));
    emotions.confidence = Math.max(0, Math.min(100, emotions.confidence));
    emotions.fear = Math.max(0, Math.min(100, emotions.fear));
    emotions.frustration = Math.max(0, Math.min(100, emotions.frustration));
    emotions.euphoria = Math.max(0, Math.min(100, emotions.euphoria));
    emotions.pride = Math.max(0, Math.min(100, emotions.pride));
    emotions.anxiety = Math.max(0, Math.min(100, emotions.anxiety));
    emotions.motivation = Math.max(0, Math.min(100, emotions.motivation));
    emotions.envy = Math.max(0, Math.min(100, emotions.envy));
    emotions.determination = Math.max(0, Math.min(100, emotions.determination));
  }

  private calculateRiskModifier(emotions: EmotionalState): number {
    // Confiança e euforia aumentam risco
    // Medo e ansiedade diminuem risco
    let modifier = 0;
    modifier += (emotions.confidence - 50) * 0.01;
    modifier += emotions.euphoria * 0.005;
    modifier -= emotions.fear * 0.01;
    modifier -= emotions.anxiety * 0.008;
    modifier += emotions.determination * 0.005;
    return Math.max(-1, Math.min(1, modifier));
  }

  private calculateAggressionModifier(emotions: EmotionalState): number {
    // Raiva aumenta agressividade
    // Medo diminui
    let modifier = 0;
    modifier += emotions.anger * 0.012;
    modifier -= emotions.fear * 0.01;
    modifier += emotions.determination * 0.005;
    return Math.max(-1, Math.min(1, modifier));
  }

  private calculateConfidenceModifier(emotions: EmotionalState): number {
    // Confiança direta
    return (emotions.confidence - 50) / 50;
  }

  private calculateCreativityModifier(emotions: EmotionalState): number {
    // Euforia e motivação aumentam criatividade
    // Frustração diminui
    let modifier = 0;
    modifier += emotions.euphoria * 0.008;
    modifier += emotions.motivation * 0.005;
    modifier -= emotions.frustration * 0.006;
    modifier -= emotions.anxiety * 0.004;
    return Math.max(-1, Math.min(1, modifier));
  }
}