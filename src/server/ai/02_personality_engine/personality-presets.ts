import { PersonalityTraits, EmotionalState, createDefaultPersonality, createDefaultEmotions } from "../core/types/player";

/**
 * Personalidades Realistas para Jogadores de Futebol
 *
 * Princípios:
 * - Maioria dos jogadores são disciplinados e jogam futebol normal
 * - Showboating (freestyle) é RARO - apenas combinações específicas
 * - Personalidade influencia ESTILO, não caos
 * - Formações são respeitadas na maioria dos casos
 */

export type PlayerPersonalityType =
  | "disciplined_defender"
  | "balanced_midfielder"
  | "clinical_striker"
  | "creative_playmaker"
  | "aggressive_tackler"
  | "showboating_winger"      // RARO
  | "consistent_goalkeeper"
  | "versatile_workhorse"
  | "star_player"             // Pode fazer show ocasionalmente
  | "veteran_leader";

export interface PersonalityPreset {
  name: string;
  traits: Partial<PersonalityTraits>;
  description: string;
  showboatingLikelihood: "none" | "rare" | "occasional" | "frequent";
}

export const PERSONALITY_PRESETS: Record<PlayerPersonalityType, PersonalityPreset> = {
  // DEFESA DISCIPLINADA - Joga futebol, respeita formação
  disciplined_defender: {
    name: "Defesa Disciplinada",
    description: "Joga futebol normal, respeita a formação, foco em eficiência",
    showboatingLikelihood: "none",
    traits: {
      egoism: 25,
      ambition: 45,
      creativity: 30,
      courage: 70,
      aggressiveness: 65,
      vanity: 20,
      confidence: 60,
      discipline: 90,
      cooperation: 75,
      envy: 25,
      pride: 40,
      competitiveness: 70,
      persistence: 75,
      composure: 65,
      impulsiveness: 25,
      adaptability: 55,
    },
  },

  // MEIO-CAMPO EQUILIBRADO - Joga futebol normal
  balanced_midfielder: {
    name: "Meio-Campo Equilibrado",
    description: "Joga futebol normal, distribui bem, respeita tática",
    showboatingLikelihood: "none",
    traits: {
      egoism: 35,
      ambition: 55,
      creativity: 55,
      courage: 55,
      aggressiveness: 45,
      vanity: 30,
      confidence: 65,
      discipline: 80,
      cooperation: 75,
      envy: 30,
      pride: 45,
      competitiveness: 65,
      persistence: 70,
      composure: 70,
      impulsiveness: 35,
      adaptability: 65,
    },
  },

  // AVANÇADO CLÍNICO - Goleador, joga futebol
  clinical_striker: {
    name: "Avançado Clínico",
    description: "Focado em marcar, joga futebol, eficiente",
    showboatingLikelihood: "rare",
    traits: {
      egoism: 60,
      ambition: 85,
      creativity: 50,
      courage: 65,
      aggressiveness: 40,
      vanity: 45,
      confidence: 75,
      discipline: 65,
      cooperation: 45,
      envy: 40,
      pride: 65,
      competitiveness: 85,
      persistence: 80,
      composure: 75,
      impulsiveness: 45,
      adaptability: 55,
    },
  },

  // MEIO-CAMPO CRIATIVO - Criativo mas disciplinado
  creative_playmaker: {
    name: "Meio-Campo Criativo",
    description: "Criativo mas disciplinado, joga futebol com estilo",
    showboatingLikelihood: "rare",
    traits: {
      egoism: 45,
      ambition: 65,
      creativity: 85,
      courage: 55,
      aggressiveness: 35,
      vanity: 50,
      confidence: 70,
      discipline: 65,
      cooperation: 65,
      envy: 35,
      pride: 55,
      competitiveness: 70,
      persistence: 65,
      composure: 70,
      impulsiveness: 40,
      adaptability: 75,
    },
  },

  // ACESSO AGRESSIVO - Agressivo mas dentro do jogo
  aggressive_tackler: {
    name: "Acessivo Agressivo",
    description: "Agressivo nas disputas, joga futebol, dentro do jogo",
    showboatingLikelihood: "none",
    traits: {
      egoism: 35,
      ambition: 55,
      creativity: 35,
      courage: 85,
      aggressiveness: 90,
      vanity: 25,
      confidence: 65,
      discipline: 70,
      cooperation: 60,
      envy: 35,
      pride: 50,
      competitiveness: 80,
      persistence: 85,
      composure: 55,
      impulsiveness: 55,
      adaptability: 50,
    },
  },

  // EXTREMO QUE FAZ SHOW - RARO! Freestyle ocasional
  showboating_winger: {
    name: "Extremo Showman",
    description: "FAZ SHOW OCASIONALMENTE - mas joga futebol na maioria dos momentos",
    showboatingLikelihood: "occasional",
    traits: {
      egoism: 75,
      ambition: 70,
      creativity: 95,      // Muito criativo
      courage: 70,
      aggressiveness: 40,
      vanity: 90,          // MUITO vaidoso
      confidence: 85,
      discipline: 35,      // BAIXA disciplina (permite show)
      cooperation: 35,
      envy: 50,
      pride: 80,
      competitiveness: 75,
      persistence: 60,
      composure: 65,
      impulsiveness: 75,   // Impulsivo
      adaptability: 70,
    },
  },

  // GOLEIRO CONSISTENTE - Nunca faz show
  consistent_goalkeeper: {
    name: "Goleiro Consistente",
    description: "Consistente, confiável, nunca faz show",
    showboatingLikelihood: "none",
    traits: {
      egoism: 30,
      ambition: 50,
      creativity: 25,
      courage: 75,
      aggressiveness: 45,
      vanity: 15,
      confidence: 70,
      discipline: 85,
      cooperation: 70,
      envy: 20,
      pride: 45,
      competitiveness: 70,
      persistence: 80,
      composure: 85,
      impulsiveness: 20,
      adaptability: 55,
    },
  },

  // TRABALHADOR VERSÁTIL - Joga futebol sempre
  versatile_workhorse: {
    name: "Trabalhador Versátil",
    description: "Trabalhador incansável, joga futebol sempre",
    showboatingLikelihood: "none",
    traits: {
      egoism: 30,
      ambition: 60,
      creativity: 45,
      courage: 65,
      aggressiveness: 55,
      vanity: 25,
      confidence: 60,
      discipline: 85,
      cooperation: 80,
      envy: 30,
      pride: 45,
      competitiveness: 70,
      persistence: 90,
      composure: 65,
      impulsiveness: 30,
      adaptability: 80,
    },
  },

  // ESTRELA - Pode fazer show ocasionalmente
  star_player: {
    name: "Estrela",
    description: "Estrela do time, PODE fazer show ocasionalmente mas joga futebol",
    showboatingLikelihood: "occasional",
    traits: {
      egoism: 65,
      ambition: 80,
      creativity: 80,
      courage: 65,
      aggressiveness: 45,
      vanity: 70,
      confidence: 85,
      discipline: 55,
      cooperation: 50,
      envy: 45,
      pride: 75,
      competitiveness: 85,
      persistence: 75,
      composure: 75,
      impulsiveness: 50,
      adaptability: 70,
    },
  },

  // VETERANO LÍDER - Nunca faz show, lidera
  veteran_leader: {
    name: "Veterano Líder",
    description: "Veterano experiente, lidera, nunca faz show",
    showboatingLikelihood: "none",
    traits: {
      egoism: 40,
      ambition: 55,
      creativity: 50,
      courage: 75,
      aggressiveness: 55,
      vanity: 30,
      confidence: 80,
      discipline: 90,
      cooperation: 80,
      envy: 25,
      pride: 65,
      competitiveness: 75,
      persistence: 85,
      composure: 85,
      impulsiveness: 25,
      adaptability: 75,
    },
  },
};

/**
 * Cria um jogador com personalidade específica
 */
export function createPlayerWithPersonality(
  type: PlayerPersonalityType
): { personality: PersonalityTraits; emotions: EmotionalState } {
  const preset = PERSONALITY_PRESETS[type];

  const personality: PersonalityTraits = {
    ...createDefaultPersonality(),
    ...preset.traits,
  };

  const emotions = createDefaultEmotions();

  return { personality, emotions };
}

/**
 * Verifica se um jogador pode fazer show nesta situação
 * IMPORTANTE: Regras estritas - show é RARO
 */
export function canPlayerShowboat(
  personality: PersonalityTraits,
  gameContext: {
    goalDifference: number;
    minutesRemaining: number;
    isWinning: boolean;
    isLosing: boolean;
  }
): boolean {
  // Condições de personalidade (TODAS devem ser verdadeiras)
  const hasHighCreativity = personality.creativity > 80;
  const hasHighVanity = personality.vanity > 75;
  const hasHighConfidence = personality.confidence > 70;
  const hasLowDiscipline = personality.discipline < 40;

  // Se qualquer condição falha, não faz show
  if (!hasHighCreativity || !hasHighVanity || !hasHighConfidence || !hasLowDiscipline) {
    return false;
  }

  // Condições de contexto
  const isWinningComfortably = gameContext.isWinning && gameContext.goalDifference >= 2;
  const notLastMinute = gameContext.minutesRemaining > 5;
  const notLosing = !gameContext.isLosing;

  // Probabilidade base (muito baixa)
  let probability = 0.05; // 5% base

  // Modificadores
  if (isWinningComfortably) probability *= 3; // 15%
  if (notLastMinute) probability *= 1.5;
  if (notLosing) probability *= 1.2;

  // Limite máximo: 10%
  probability = Math.min(probability, 0.10);

  return Math.random() < probability;
}

/**
 * Retorna estatísticas sobre personalidades
 */
export function getPersonalityStats(): {
  totalPresets: number;
  showboatingPresets: number;
  averageDiscipline: number;
  averageCreativity: number;
} {
  const presets = Object.values(PERSONALITY_PRESETS);
  const total = presets.length;

  const showboatingCount = presets.filter(
    (p) => p.showboatingLikelihood !== "none"
  ).length;

  const avgDiscipline =
    presets.reduce((sum, p) => sum + (p.traits.discipline || 50), 0) / total;

  const avgCreativity =
    presets.reduce((sum, p) => sum + (p.traits.creativity || 50), 0) / total;

  return {
    totalPresets: total,
    showboatingPresets: showboatingCount,
    averageDiscipline: avgDiscipline,
    averageCreativity: avgCreativity,
  };
}