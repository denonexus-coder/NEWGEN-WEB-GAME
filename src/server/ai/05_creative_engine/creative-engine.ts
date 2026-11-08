import { PlayerState, PlayerRole } from "../core/types/player";
import { BallState } from "../core/types/ball";
import { Vector3D, vec3, vecDistance, vecLength, vecNormalize } from "../core/math/vector3d";
import { AIConfig } from "../core/config";
import { PersonalityEngine } from "../02_personality_engine/personality-engine";
import { EmotionEngine } from "../03_emotion_engine/emotion-engine";

/**
 * Creative Engine
 *
 * Sistema de criatividade contextual:
 * - Identifica oportunidades para ações inesperadas
 * - Avalia risco antes de tentar jogadas criativas
 * - Apenas jogadores com criatividade + confiança tentam
 * - Maioria joga futebol normal
 * - Biblioteca de movimentos específicos
 */

export enum CreativeAction {
  // Dribles
  BodyFeint = "BODY_FEINT",
  StepOver = "STEP_OVER",
  DoubleTouch = "DOUBLE_TOUCH",
  Roulette = "ROULETTE",
  Elastico = "ELASTICO",
  Nutmeg = "NUTMEG",
  CustomDribble = "CUSTOM_DRIBBLE",

  // Passes
  ShortPass = "SHORT_PASS",
  ThroughBall = "THROUGH_BALL",
  LobPass = "LOB_PASS",
  OneTouchPass = "ONE_TOUCH_PASS",
  CreativePass = "CREATIVE_PASS",

  // Remates
  PowerShot = "POWER_SHOT",
  FinesseShot = "FINESSE_SHOT",
  ChipShot = "CHIP_SHOT",
  FirstTimeShot = "FIRST_TIME_SHOT",
  AcrobaticShot = "ACROBATIC_SHOT",

  // Outros
  ImprovisedPlay = "IMPROVISED_PLAY",
  BodyMovement = "BODY_MOVEMENT",
}

export interface CreativeOption {
  action: CreativeAction;
  creativityScore: number;   // 0-100
  riskLevel: number;         // 0-1
  successProbability: number; // 0-1
  impressiveness: number;    // 0-1 (quanto impressiona)
  requiredAttributes: {
    technique: number;
    creativity: number;
    confidence: number;
    balance: number;
  };
}

export interface CreativeContext {
  distanceToGoal: number;
  distanceToNearestOpponent: number;
  hasSpace: boolean;
  isUnderPressure: boolean;
  teammatesOpen: number;
  opponentsNearby: number;
  isInFinalThird: boolean;
  isCounterAttack: boolean;
}

export class CreativeEngine {
  private config: AIConfig;
  private personalityEngine: PersonalityEngine;
  private emotionEngine: EmotionEngine;

  // Biblioteca de movimentos
  private moveLibrary: Map<CreativeAction, MoveDefinition> = new Map();

  constructor(
    config: AIConfig,
    personalityEngine: PersonalityEngine,
    emotionEngine: EmotionEngine
  ) {
    this.config = config;
    this.personalityEngine = personalityEngine;
    this.emotionEngine = emotionEngine;
    this.initializeMoveLibrary();
  }

  /**
   * Gera opções criativas para a situação atual
   */
  generateCreativeOptions(
    player: PlayerState,
    ball: BallState,
    context: CreativeContext
  ): CreativeOption[] {
    const options: CreativeOption[] = [];

    // Só gerar opções criativas se jogador tem personalidade adequada
    if (!this.shouldAttemptCreative(player)) {
      return options;
    }

    // Dribles criativos
    if (context.distanceToNearestOpponent < 10) {
      options.push(...this.generateDribbleOptions(player, context));
    }

    // Passes criativos
    if (context.teammatesOpen > 0) {
      options.push(...this.generateCreativePassOptions(player, context));
    }

    // Remates criativos
    if (context.distanceToGoal < 30) {
      options.push(...this.generateCreativeShotOptions(player, context));
    }

    // Jogada improvisada
    if (this.shouldImprovise(player, context)) {
      options.push(this.generateImprovisedOption(player, context));
    }

    // Filtrar por atributos mínimos
    return options.filter((opt) => this.meetsRequirements(player, opt));
  }

  /**
   * Seleciona melhor opção criativa (ou nenhuma)
   */
  selectCreativeAction(
    player: PlayerState,
    options: CreativeOption[]
  ): CreativeOption | null {
    if (options.length === 0) return null;

    // Avaliar cada opção
    const evaluated = options.map((opt) => ({
      option: opt,
      score: this.evaluateCreativeOption(player, opt),
    }));

    // Ordenar por pontuação
    evaluated.sort((a, b) => b.score - a.score);

    const best = evaluated[0];

    // Verificar se vale a pena (limiar mínimo)
    if (best.score < 40) return null;

    // Probabilidade baseada na pontuação
    const probability = best.score / 100;
    if (Math.random() > probability) return null;

    return best.option;
  }

  /**
   * Calcula pontuação de criatividade de uma ação
   */
  private evaluateCreativeOption(
    player: PlayerState,
    option: CreativeOption
  ): number {
    let score = 0;

    // 1. Atributos do jogador (0-40)
    score += (player.technical.technique / 100) * 15;
    score += (player.personality.creativity / 100) * 15;
    score += (player.personality.confidence / 100) * 10;

    // 2. Personalidade (0-30)
    const influence = this.personalityEngine.calculateInfluence(player);
    score += (influence.creativityModifier + 1) * 10; // 0-20
    score += (player.personality.vanity / 100) * 10; // 0-10

    // 3. Emoções (0-15)
    const emotionalInfluence = this.emotionEngine.getEmotionalInfluence(player.id);
    score += (emotionalInfluence.creativityModifier + 1) * 7.5; // 0-15

    // 4. Ajuste por risco (penaliza muito arriscado)
    score -= option.riskLevel * 20;

    // 5. Bónus por impressão (para jogadores vaidosos)
    if (player.personality.vanity > 70) {
      score += option.impressiveness * 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Verifica se jogador deve tentar ação criativa
   */
  private shouldAttemptCreative(player: PlayerState): boolean {
    const p = player.personality;

    // Condições mínimas (mais flexíveis)
    const hasCreativity = p.creativity > 45;
    const hasConfidence = p.confidence > 40;
    const hasTechnique = player.technical.technique > 45;

    if (!hasCreativity || !hasConfidence || !hasTechnique) {
      return false;
    }

    // Jogadores de elite (criatividade e técnica de topo) SEMPRE
    // consideram jogadas criativas - a seleccao rara e feita pelos
    // portoes seguintes (personality shouldShowboat + behavior gate)
    if (p.creativity > 85 && player.technical.technique > 75) {
      return true;
    }

    // Probabilidade baseada na personalidade
    let probability = (p.creativity / 100) * 0.4; // Max 40%

    // Vaidade aumenta
    probability += (p.vanity / 100) * 0.25;

    // Disciplina reduz
    probability -= (p.discipline / 100) * 0.1;

    // Egoísmo aumenta
    probability += (p.egoism / 100) * 0.15;

    // Criatividade alta garante tentativa
    if (p.creativity > 75) probability += 0.2;
    if (p.creativity > 85) probability += 0.15;

    probability = Math.max(0, Math.min(0.7, probability));

    return Math.random() < probability;
  }

  /**
   * Verifica se jogador deve improvisar
   */
  private shouldImprovise(player: PlayerState, context: CreativeContext): boolean {
    const p = player.personality;

    // Só jogadores muito criativos improvisam
    if (p.creativity < 75) return false;
    if (p.impulsiveness < 50) return false;

    // Mais provável sob pressão (reagir instintivamente)
    let probability = 0.1;
    if (context.isUnderPressure) probability += 0.15;
    if (context.isCounterAttack) probability += 0.1;

    probability += (p.impulsiveness / 100) * 0.2;

    return Math.random() < probability;
  }

  /**
   * Gera opções de drible criativo
   */
  private generateDribbleOptions(
    player: PlayerState,
    context: CreativeContext
  ): CreativeOption[] {
    const options: CreativeOption[] = [];

    // Body Feint - seguro
    options.push({
      action: CreativeAction.BodyFeint,
      creativityScore: 40,
      riskLevel: 0.3,
      successProbability: 0.7,
      impressiveness: 0.4,
      requiredAttributes: {
        technique: 50,
        creativity: 50,
        confidence: 50,
        balance: 55,
      },
    });

    // Step Over - moderado
    options.push({
      action: CreativeAction.StepOver,
      creativityScore: 55,
      riskLevel: 0.4,
      successProbability: 0.6,
      impressiveness: 0.6,
      requiredAttributes: {
        technique: 60,
        creativity: 55,
        confidence: 55,
        balance: 60,
      },
    });

    // Double Touch - avançado
    options.push({
      action: CreativeAction.DoubleTouch,
      creativityScore: 65,
      riskLevel: 0.5,
      successProbability: 0.55,
      impressiveness: 0.7,
      requiredAttributes: {
        technique: 70,
        creativity: 60,
        confidence: 60,
        balance: 65,
      },
    });

    // Roulette - muito avançado
    options.push({
      action: CreativeAction.Roulette,
      creativityScore: 75,
      riskLevel: 0.6,
      successProbability: 0.45,
      impressiveness: 0.85,
      requiredAttributes: {
        technique: 75,
        creativity: 65,
        confidence: 65,
        balance: 70,
      },
    });

    // Elastico - expert
    options.push({
      action: CreativeAction.Elastico,
      creativityScore: 85,
      riskLevel: 0.7,
      successProbability: 0.35,
      impressiveness: 0.95,
      requiredAttributes: {
        technique: 85,
        creativity: 75,
        confidence: 70,
        balance: 75,
      },
    });

    // Nutmeg - depende de oponente
    if (context.distanceToNearestOpponent < 3) {
      options.push({
        action: CreativeAction.Nutmeg,
        creativityScore: 90,
        riskLevel: 0.8,
        successProbability: 0.25,
        impressiveness: 1.0,
        requiredAttributes: {
          technique: 80,
          creativity: 80,
          confidence: 75,
          balance: 70,
        },
      });
    }

    return options;
  }

  /**
   * Gera opções de passe criativo
   */
  private generateCreativePassOptions(
    player: PlayerState,
    context: CreativeContext
  ): CreativeOption[] {
    const options: CreativeOption[] = [];

    // Passe criativo curto
    options.push({
      action: CreativeAction.CreativePass,
      creativityScore: 60,
      riskLevel: 0.35,
      successProbability: 0.65,
      impressiveness: 0.6,
      requiredAttributes: {
        technique: 65,
        creativity: 65,
        confidence: 60,
        balance: 50,
      },
    });

    // Bola em profundidade
    if (context.isInFinalThird || context.isCounterAttack) {
      options.push({
        action: CreativeAction.ThroughBall,
        creativityScore: 70,
        riskLevel: 0.5,
        successProbability: 0.5,
        impressiveness: 0.75,
        requiredAttributes: {
          technique: 70,
          creativity: 70,
          confidence: 65,
          balance: 55,
        },
      });
    }

    // Passe em arco
    options.push({
      action: CreativeAction.LobPass,
      creativityScore: 65,
      riskLevel: 0.55,
      successProbability: 0.45,
      impressiveness: 0.7,
      requiredAttributes: {
        technique: 75,
        creativity: 60,
        confidence: 65,
        balance: 55,
      },
    });

    return options;
  }

  /**
   * Gera opções de remate criativo
   */
  private generateCreativeShotOptions(
    player: PlayerState,
    context: CreativeContext
  ): CreativeOption[] {
    const options: CreativeOption[] = [];

    // Remate colocado
    options.push({
      action: CreativeAction.FinesseShot,
      creativityScore: 50,
      riskLevel: 0.3,
      successProbability: 0.55,
      impressiveness: 0.5,
      requiredAttributes: {
        technique: 70,
        creativity: 55,
        confidence: 65,
        balance: 60,
      },
    });

    // Remate em cunha (chip)
    if (context.distanceToGoal < 20 && context.hasSpace) {
      options.push({
        action: CreativeAction.ChipShot,
        creativityScore: 75,
        riskLevel: 0.65,
        successProbability: 0.35,
        impressiveness: 0.9,
        requiredAttributes: {
          technique: 80,
          creativity: 70,
          confidence: 70,
          balance: 65,
        },
      });
    }

    // Remate acrobático
    if (context.distanceToGoal < 25 && !context.hasSpace) {
      options.push({
        action: CreativeAction.AcrobaticShot,
        creativityScore: 95,
        riskLevel: 0.85,
        successProbability: 0.15,
        impressiveness: 1.0,
        requiredAttributes: {
          technique: 90,
          creativity: 85,
          confidence: 80,
          balance: 85,
        },
      });
    }

    // Remate de primeira
    if (context.isCounterAttack) {
      options.push({
        action: CreativeAction.FirstTimeShot,
        creativityScore: 60,
        riskLevel: 0.5,
        successProbability: 0.4,
        impressiveness: 0.7,
        requiredAttributes: {
          technique: 75,
          creativity: 60,
          confidence: 70,
          balance: 65,
        },
      });
    }

    return options;
  }

  /**
   * Gera opção improvisada
   */
  private generateImprovisedOption(
    player: PlayerState,
    context: CreativeContext
  ): CreativeOption {
    return {
      action: CreativeAction.ImprovisedPlay,
      creativityScore: 100,
      riskLevel: 0.7,
      successProbability: 0.3,
      impressiveness: 0.95,
      requiredAttributes: {
        technique: 80,
        creativity: 85,
        confidence: 75,
        balance: 70,
      },
    };
  }

  /**
   * Verifica se jogador atende requisitos mínimos
   */
  private meetsRequirements(player: PlayerState, option: CreativeOption): boolean {
    return (
      player.technical.technique >= option.requiredAttributes.technique * 0.8 &&
      player.personality.creativity >= option.requiredAttributes.creativity * 0.8 &&
      player.personality.confidence >= option.requiredAttributes.confidence * 0.8
    );
  }

  /**
   * Inicializa biblioteca de movimentos
   */
  private initializeMoveLibrary(): void {
    this.moveLibrary.set(CreativeAction.BodyFeint, {
      name: "Body Feint",
      description: "Movimento corporal para enganar oponente",
      executionTime: 0.3,
      staminaCost: 5,
      animationType: "body_feint",
    });

    this.moveLibrary.set(CreativeAction.StepOver, {
      name: "Step Over",
      description: "Passe por cima da bola",
      executionTime: 0.4,
      staminaCost: 7,
      animationType: "step_over",
    });

    this.moveLibrary.set(CreativeAction.Roulette, {
      name: "Roulette",
      description: "Giro completo com a bola",
      executionTime: 0.6,
      staminaCost: 12,
      animationType: "roulette",
    });

    this.moveLibrary.set(CreativeAction.Elastico, {
      name: "Elastico",
      description: "Toque duplo rápido",
      executionTime: 0.5,
      staminaCost: 10,
      animationType: "elastico",
    });

    this.moveLibrary.set(CreativeAction.Nutmeg, {
      name: "Nutmeg",
      description: "Passar bola entre pernas do oponente",
      executionTime: 0.4,
      staminaCost: 8,
      animationType: "nutmeg",
    });
  }

  /**
   * Obtém definição de um movimento
   */
  getMoveDefinition(action: CreativeAction): MoveDefinition | null {
    return this.moveLibrary.get(action) || null;
  }

  /**
   * Obtém descrição da ação criativa
   */
  getActionDescription(action: CreativeAction): string {
    const definitions: Record<CreativeAction, string> = {
      [CreativeAction.BodyFeint]: "Finta corporal",
      [CreativeAction.StepOver]: "Passe por cima",
      [CreativeAction.DoubleTouch]: "Toque duplo",
      [CreativeAction.Roulette]: "Giro completo",
      [CreativeAction.Elastico]: "Elastico",
      [CreativeAction.Nutmeg]: "Túnel",
      [CreativeAction.CustomDribble]: "Drible personalizado",
      [CreativeAction.ShortPass]: "Passe curto",
      [CreativeAction.ThroughBall]: "Bola em profundidade",
      [CreativeAction.LobPass]: "Passe em arco",
      [CreativeAction.OneTouchPass]: "Passe de primeira",
      [CreativeAction.CreativePass]: "Passe criativo",
      [CreativeAction.PowerShot]: "Remate forte",
      [CreativeAction.FinesseShot]: "Remate colocado",
      [CreativeAction.ChipShot]: "Remate em cunha",
      [CreativeAction.FirstTimeShot]: "Remate de primeira",
      [CreativeAction.AcrobaticShot]: "Remate acrobático",
      [CreativeAction.ImprovisedPlay]: "Jogada improvisada",
      [CreativeAction.BodyMovement]: "Movimento corporal",
    };
    return definitions[action] || action;
  }
}

// ==================== TIPOS AUXILIARES ====================

export interface MoveDefinition {
  name: string;
  description: string;
  executionTime: number; // segundos
  staminaCost: number;
  animationType: string;
}