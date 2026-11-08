import {
  PlayerState,
  PlayerRole,
  createPlayer,
  createDefaultPersonality,
} from "../ai/core/types/player";
import { Vector3D, vec3 } from "../ai/core/math/vector3d";
import {
  TacticalFormation,
  FormationSlot,
  create442,
  create433,
  create352,
  create532,
  create4231,
} from "../ai/02_personality_engine/formation-system";
import {
  PERSONALITY_PRESETS,
  PlayerPersonalityType,
} from "../ai/02_personality_engine/personality-presets";

/**
 * Torneio - Equipas
 *
 * 6 equipas com identidades DISTINTAS:
 * formação + estilo tático + personalidades por posição + atributos
 * moldados pelo estilo (posse = técnica, pressing = velocidade...).
 */

export type TeamStyle =
  | "defensive"
  | "possession"
  | "pressing"
  | "balanced"
  | "counter"
  | "veteran";

export interface TeamProfile {
  id: number;
  name: string;
  short: string;
  style: TeamStyle;
  description: string;
  formation: TacticalFormation;
  gkPreset: PlayerPersonalityType;
  defPreset: PlayerPersonalityType;
  midPreset: PlayerPersonalityType;
  fwdPreset: PlayerPersonalityType;
  wingerPreset?: PlayerPersonalityType;
  techRange: [number, number];
  paceRange: [number, number];
}

export interface TournamentTeam {
  profile: TeamProfile;
  /** players[i] ocupa slots[i] da formação */
  players: PlayerState[];
  slots: FormationSlot[];
}

export function createTournamentTeams(): TeamProfile[] {
  return [
    {
      id: 1,
      name: "Atlético Robô",
      short: "ATR",
      style: "defensive",
      description: "5-3-2 encerrado, disciplina total, sem showboating",
      formation: create532(),
      gkPreset: "consistent_goalkeeper",
      defPreset: "disciplined_defender",
      midPreset: "versatile_workhorse",
      fwdPreset: "clinical_striker",
      techRange: [58, 74],
      paceRange: [58, 76],
    },
    {
      id: 2,
      name: "FC Criatividade",
      short: "FCR",
      style: "possession",
      description: "4-3-3 de posse, extremos showman, jogadores criativos",
      formation: create433(),
      gkPreset: "consistent_goalkeeper",
      defPreset: "disciplined_defender",
      midPreset: "creative_playmaker",
      fwdPreset: "clinical_striker",
      wingerPreset: "showboating_winger",
      techRange: [72, 92],
      paceRange: [58, 78],
    },
    {
      id: 3,
      name: "União dos Brutos",
      short: "UDB",
      style: "pressing",
      description: "4-4-2 agressivo, pressing alto, força e velocidade",
      formation: create442(),
      gkPreset: "consistent_goalkeeper",
      defPreset: "aggressive_tackler",
      midPreset: "aggressive_tackler",
      fwdPreset: "clinical_striker",
      techRange: [56, 72],
      paceRange: [72, 92],
    },
    {
      id: 4,
      name: "Real Equilíbrio",
      short: "REQ",
      style: "balanced",
      description: "4-2-3-1 versátil, sem extremismos, futebol sólido",
      formation: create4231(),
      gkPreset: "consistent_goalkeeper",
      defPreset: "versatile_workhorse",
      midPreset: "balanced_midfielder",
      fwdPreset: "clinical_striker",
      techRange: [64, 82],
      paceRange: [64, 82],
    },
    {
      id: 5,
      name: "Contragolpe FC",
      short: "CTG",
      style: "counter",
      description: "4-3-3 directo, velocidade nas alas, golo cedo",
      formation: create433(),
      gkPreset: "consistent_goalkeeper",
      defPreset: "versatile_workhorse",
      midPreset: "balanced_midfielder",
      fwdPreset: "clinical_striker",
      wingerPreset: "showboating_winger",
      techRange: [62, 80],
      paceRange: [76, 94],
    },
    {
      id: 6,
      name: "Veteranos FC",
      short: "VET",
      style: "veteran",
      description: "3-5-2 de experiência, liderança e inteligência",
      formation: create352(),
      gkPreset: "consistent_goalkeeper",
      defPreset: "veteran_leader",
      midPreset: "veteran_leader",
      fwdPreset: "clinical_striker",
      wingerPreset: "creative_playmaker",
      techRange: [68, 86],
      paceRange: [54, 72],
    },
  ];
}

function presetForRole(profile: TeamProfile, role: PlayerRole): PlayerPersonalityType {
  switch (role) {
    case PlayerRole.Goalkeeper:
      return profile.gkPreset;
    case PlayerRole.DefenderLeft:
    case PlayerRole.DefenderCenter:
    case PlayerRole.DefenderRight:
      return profile.defPreset;
    case PlayerRole.MidfielderDefensive:
    case PlayerRole.MidfielderCenter:
      return profile.midPreset;
    case PlayerRole.WingerLeft:
    case PlayerRole.WingerRight:
      return profile.wingerPreset ?? profile.fwdPreset;
    default:
      return profile.fwdPreset;
  }
}

function lerp(range: [number, number], rand: () => number): number {
  return range[0] + rand() * (range[1] - range[0]);
}

/**
 * Constrói a equipa com atributos moldados pelo estilo.
 * rand = função aleatória (dentro do RNG com semente do torneio).
 */
export function buildTeam(profile: TeamProfile, rand: () => number): TournamentTeam {
  const slots = profile.formation.getAllPositions();

  const players = slots.map((slot, i) => {
    const preset = presetForRole(profile, slot.role);
    const player = createPlayer(
      profile.id * 100 + i,
      `${profile.short} ${i + 1}`,
      slot.role,
      profile.id,
      i + 1
    );

    player.personality = {
      ...createDefaultPersonality(),
      ...PERSONALITY_PRESETS[preset].traits,
    };

    // Atributos moldados pelo estilo
    player.technical.technique = Math.round(lerp(profile.techRange, rand));
    player.technical.passing = Math.round(lerp(profile.techRange, rand) - 5);
    player.technical.dribbling = Math.round(lerp(profile.techRange, rand));
    player.technical.shooting = Math.round(55 + rand() * 35);
    player.physical.pace = Math.round(lerp(profile.paceRange, rand));
    player.physical.acceleration = Math.round(lerp(profile.paceRange, rand) - 3);
    player.physical.reactions = Math.round(55 + rand() * 35);
    player.mental.anticipation = Math.round(55 + rand() * 35);
    player.mental.decisions = Math.round(55 + rand() * 35);

    if (slot.role === PlayerRole.Goalkeeper) {
      // GR: reflexos e colocação em vez de drible
      player.technical.positioning = Math.round(70 + rand() * 25);
      player.physical.reactions = Math.round(72 + rand() * 25);
      player.mental.anticipation = Math.round(68 + rand() * 27);
      player.physical.pace = Math.round(45 + rand() * 20);
      player.physical.acceleration = Math.round(45 + rand() * 20);
    }

    player.position = vec3(slot.x, slot.y, 0);
    return player;
  });

  return { profile, players, slots };
}

/**
 * Posição base da formação para um jogador (frame de ataque +x).
 * ATENÇÃO: formações podem ter slots duplicados (ex: dois DC) -
 * usa o índice do slot, não a pesquisa por role.
 */
export function basePosition(team: TournamentTeam, index: number): Vector3D {
  const slot = team.slots[index];
  return vec3(slot.x, slot.y, 0);
}

export function isForwardRole(role: PlayerRole): boolean {
  return (
    role === PlayerRole.Striker ||
    role === PlayerRole.StrikerSecond ||
    role === PlayerRole.WingerLeft ||
    role === PlayerRole.WingerRight ||
    role === PlayerRole.MidfielderAttacking
  );
}
