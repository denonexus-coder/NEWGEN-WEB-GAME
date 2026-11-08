import { PlayerState, PlayerRole, PersonalityTraits } from "../core/types/player";
import { AIConfig } from "../core/config";

/**
 * Personality Engine
 *
 * Princípios:
 * - Personalidade influencia COMO o jogador executa, não O QUE decide na maioria dos casos
 * - Jogadores respeitam formação e disciplina tática
 * - Só jogadores com combinações específicas fazem "show"
 * - A maioria joga futebol normal
 */

export interface PersonalityInfluence {
  // O que a personalidade adiciona/subtrai à decisão
  riskModifier: number;        // -1 a 1 (quanto mais arrisca)
  creativityModifier: number;  // -1 a 1 (quanto mais criativo)
  aggressionModifier: number;  // -1 a 1 (quanto mais agressivo)
  disciplineModifier: number;  // -1 a 1 (quanto mais disciplinado)
  teamworkModifier: number;    // -1 a 1 (quanto mais coletivo)
  showboatingTendency: number; // 0 a 1 (probabilidade de "se exibir")
  leadershipModifier: number;  // -1 a 1
}

export class PersonalityEngine {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * Calcula a influência da personalidade nas decisões do jogador
   */
  calculateInfluence(player: PlayerState): PersonalityInfluence {
    const p = player.personality;

    return {
      riskModifier: this.normalizeRisk(p.courage, p.impulsiveness, p.discipline),
      creativityModifier: this.normalizeCreativity(p.creativity, p.discipline),
      aggressionModifier: this.normalizeAggression(p.aggressiveness, p.competitiveness),
      disciplineModifier: this.normalizeDiscipline(p.discipline, p.ambition),
      teamworkModifier: this.normalizeTeamwork(p.cooperation, p.egoism),
      showboatingTendency: this.calculateShowboating(p),
      leadershipModifier: this.normalizeLeadership(p.pride, p.competitiveness),
    };
  }

  /**
   * Determina se o jogador deve "se exibir" neste momento
   * Regra: Só combinações muito específicas de personalidade fazem isso
   */
  shouldShowboat(player: PlayerState, gameContext: GameContext): boolean {
    const p = player.personality;
    const influence = this.calculateInfluence(player);

    // Condições necessárias (todas devem ser verdadeiras)
    const hasHighCreativity = p.creativity > 80;
    const hasHighVanity = p.vanity > 75;
    const hasHighConfidence = p.confidence > 70;
    const hasLowDiscipline = p.discipline < 40;
    const isForwardRole = player.role === PlayerRole.Striker ||
                          player.role === PlayerRole.WingerLeft ||
                          player.role === PlayerRole.WingerRight ||
                          player.role === PlayerRole.MidfielderAttacking;

    // Condições de contexto
    const isWinning = gameContext.isWinning;
    const isComfortableLead = gameContext.goalDifference >= 2;
    const notLastMinute = gameContext.minutesRemaining > 5;
    const teamLosing = gameContext.isLosing;

    // Probabilidade baseada na personalidade
    let probability = influence.showboatingTendency;

    // Modificadores de contexto
    if (isComfortableLead) probability *= 1.5; // Mais confiança com vantagem
    if (isWinning) probability *= 1.2;
    if (teamLosing) probability *= 0.3; // Menos show quando perde
    if (!notLastMinute) probability *= 0.5; // Menos nos últimos minutos
    if (!isForwardRole) probability *= 0.2; // Defesas raramente fazem show

    // Limite máximo de probabilidade (nunca mais de 20% em qualquer situação)
    probability = Math.min(probability, 0.20);

    return Math.random() < probability;
  }

  /**
   * Avalia se uma ação é apropriada para a personalidade do jogador
   * NOTA: Isso modifica a pontuação, não bloqueia ações
   */
  evaluateActionFit(
    player: PlayerState,
    action: ActionType,
    context: ActionContext
  ): number {
    const influence = this.calculateInfluence(player);
    let scoreAdjustment = 0;

    switch (action) {
      case ActionType.Pass:
        // Jogadores disciplinados e cooperativos favorecem passe
        scoreAdjustment += influence.disciplineModifier * 15;
        scoreAdjustment += influence.teamworkModifier * 10;
        // Egoístas penalizam passe
        scoreAdjustment -= (player.personality.egoism / 100) * 10;
        break;

      case ActionType.Shoot:
        // Ambiciosos e egoístas favorecem remate
        scoreAdjustment += (player.personality.ambition / 100) * 10;
        scoreAdjustment += (player.personality.egoism / 100) * 8;
        // Criativos com vão favorecem remate criativo
        if (context.hasSpace && player.personality.creativity > 60) {
          scoreAdjustment += 5;
        }
        break;

      case ActionType.Dribble:
        // Criativos e confiantes favorecem drible
        scoreAdjustment += influence.creativityModifier * 12;
        scoreAdjustment += (player.personality.confidence / 100) * 8;
        // Disciplina penaliza drible desnecessário
        scoreAdjustment -= influence.disciplineModifier * 5;
        // Risco: impulsivos arriscam mais
        scoreAdjustment += influence.riskModifier * 6;
        break;

      case ActionType.Defend:
        // Disciplina e agressividade favorecem defesa
        scoreAdjustment += influence.disciplineModifier * 12;
        scoreAdjustment += influence.aggressionModifier * 8;
        // Egoísmo penaliza defesa
        scoreAdjustment -= (player.personality.egoism / 100) * 8;
        break;

      case ActionType.Position:
        // Disciplina favorece posicionamento
        scoreAdjustment += influence.disciplineModifier * 15;
        // Ambição pode fazer jogador sair de posição
        scoreAdjustment -= (player.personality.ambition / 100) * 5;
        break;

      case ActionType.Support:
        // Cooperatividade favorece apoio
        scoreAdjustment += influence.teamworkModifier * 12;
        break;
    }

    // Fator de personalidade global (influência reduzida)
    const personalityWeight = this.config.personalityInfluence;
    return scoreAdjustment * personalityWeight;
  }

  /**
   * Avalia se o jogador respeita a formação tática
   * IMPORTANTE: A maioria dos jogadores respeita a formação
   */
  respectsFormation(player: PlayerState, formationPosition: { x: number; y: number }): boolean {
    const p = player.personality;
    const influence = this.calculateInfluence(player);

    // Base: todos respeitam formação
    let respectProbability = 0.95; // 95% base

    // Disciplina aumenta respeito
    respectProbability += (p.discipline / 100) * 0.04; // +4%

    // Ambição pode fazer sair de posição (raro)
    respectProbability -= (p.ambition / 100) * 0.03; // -3%

    // Egoísmo pode ignorar formação (raro)
    respectProbability -= (p.egoism / 100) * 0.02; // -2%

    // Criatividade pode explorar (raro)
    if (p.creativity > 80 && p.discipline < 50) {
      respectProbability -= 0.05; // -5%
    }

    // Garante mínimo de 70%
    respectProbability = Math.max(respectProbability, 0.70);

    return Math.random() < respectProbability;
  }

  /**
   * Retorna a posição tática esperada para o jogador
   */
  getExpectedPosition(
    player: PlayerState,
    ballPosition: { x: number; y: number },
    formation: Formation
  ): { x: number; y: number } {
    const rolePos = formation.getPosition(player.role);
    const influence = this.calculateInfluence(player);

    // Posição base da formação
    let targetX = rolePos.x;
    let targetY = rolePos.y;

    // Ajuste baseado na posição da bola
    const ballInfluence = 0.3; // 30% de influência da bola

    // Defensivos ficam mais atrás
    if (this.isDefensiveRole(player.role)) {
      targetX -= ballInfluence * (ballPosition.x - 50) * 0.5;
    }

    // Ofensivos avançam mais
    if (this.isOffensiveRole(player.role)) {
      targetX += ballInfluence * (ballPosition.x - 50) * 0.3;
    }

    // Meio-campistas acompanham bola lateralmente
    if (player.role === PlayerRole.MidfielderCenter) {
      targetX += (ballPosition.x - 50) * 0.4;
      targetY += (ballPosition.y - 32.5) * 0.2;
    }

    // Extremos ficam nas linhas
    if (player.role === PlayerRole.WingerLeft) {
      targetY = 10; // Linha esquerda
    } else if (player.role === PlayerRole.WingerRight) {
      targetY = 55; // Linha direita
    }

    // Ajuste por personalidade (pequeno)
    if (influence.disciplineModifier < 0) {
      // Menos disciplinado pode ficar um pouco fora
      targetX += (Math.random() - 0.5) * 5;
      targetY += (Math.random() - 0.5) * 5;
    }

    return { x: targetX, y: targetY };
  }

  // ==================== MÉTODOS PRIVADOS ====================

  private normalizeRisk(courage: number, impulsiveness: number, discipline: number): number {
    // Coragem aumenta risco, impulsividade aumenta, disciplina diminui
    const raw = (courage * 0.4 + impulsiveness * 0.3 - discipline * 0.3) / 100;
    return Math.max(-1, Math.min(1, raw * 2 - 0.5));
  }

  private normalizeCreativity(creativity: number, discipline: number): number {
    const raw = (creativity * 0.7 - discipline * 0.3) / 100;
    return Math.max(-1, Math.min(1, raw * 2 - 0.5));
  }

  private normalizeAggression(aggressiveness: number, competitiveness: number): number {
    const raw = (aggressiveness * 0.6 + competitiveness * 0.4) / 100;
    return Math.max(-1, Math.min(1, raw * 2 - 0.5));
  }

  private normalizeDiscipline(discipline: number, ambition: number): number {
    const raw = (discipline * 0.7 - ambition * 0.3) / 100;
    return Math.max(-1, Math.min(1, raw * 2 - 0.5));
  }

  private normalizeTeamwork(cooperation: number, egoism: number): number {
    const raw = (cooperation * 0.6 - egoism * 0.4) / 100;
    return Math.max(-1, Math.min(1, raw * 2 - 0.5));
  }

  private normalizeLeadership(pride: number, competitiveness: number): number {
    const raw = (pride * 0.5 + competitiveness * 0.5) / 100;
    return Math.max(-1, Math.min(1, raw * 2 - 0.5));
  }

  private calculateShowboating(p: PersonalityTraits): number {
    // Apenas combinações muito específicas geram showboating
    // Fórmula: criatividade * vaidade * confiança * (1 - disciplina)

    const creativity = p.creativity / 100;
    const vanity = p.vanity / 100;
    const confidence = p.confidence / 100;
    const lowDiscipline = 1 - (p.discipline / 100);
    const impulsiveness = p.impulsiveness / 100;

    // Multiplicativo: todos precisam ser altos
    let tendency = creativity * vanity * confidence * lowDiscipline * impulsiveness;

    // Só se criatividade > 70 e vaidade > 60
    if (p.creativity < 70 || p.vanity < 60) {
      tendency = 0;
    }

    // Escala para 0-1 (máximo teórico ~0.3)
    return Math.min(tendency * 3, 1.0);
  }

  private isDefensiveRole(role: PlayerRole): boolean {
    return role === PlayerRole.DefenderLeft ||
           role === PlayerRole.DefenderCenter ||
           role === PlayerRole.DefenderRight ||
           role === PlayerRole.MidfielderDefensive;
  }

  private isOffensiveRole(role: PlayerRole): boolean {
    return role === PlayerRole.Striker ||
           role === PlayerRole.StrikerSecond ||
           role === PlayerRole.WingerLeft ||
           role === PlayerRole.WingerRight ||
           role === PlayerRole.MidfielderAttacking;
  }
}

// ==================== TIPOS AUXILIARES ====================

export enum ActionType {
  Pass = "PASS",
  Shoot = "SHOOT",
  Dribble = "DRIBBLE",
  Defend = "DEFEND",
  Position = "POSITION",
  Support = "SUPPORT",
}

export interface ActionContext {
  hasSpace: boolean;
  isUnderPressure: boolean;
  isNearGoal: boolean;
  hasOpenTeammate: boolean;
}

export interface GameContext {
  isWinning: boolean;
  isLosing: boolean;
  goalDifference: number;
  minutesRemaining: number;
}

export interface FormationPosition {
  x: number;
  y: number;
  role: PlayerRole;
}

export interface Formation {
  name: string;
  positions: Map<PlayerRole, FormationPosition>;
  getPosition(role: PlayerRole): FormationPosition;
}