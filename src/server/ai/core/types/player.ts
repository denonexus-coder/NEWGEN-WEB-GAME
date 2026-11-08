import { Vector3D, vec3 } from "../math/vector3d";

export enum PlayerRole {
  Goalkeeper = "GK",
  DefenderLeft = "DL",
  DefenderCenter = "DC",
  DefenderRight = "DR",
  MidfielderDefensive = "DM",
  MidfielderCenter = "CM",
  MidfielderAttacking = "AM",
  WingerLeft = "WL",
  WingerRight = "WR",
  Striker = "ST",
  StrikerSecond = "SS",
}

export interface PersonalityTraits {
  egoism: number;
  ambition: number;
  creativity: number;
  courage: number;
  aggressiveness: number;
  vanity: number;
  confidence: number;
  discipline: number;
  cooperation: number;
  envy: number;
  pride: number;
  competitiveness: number;
  persistence: number;
  composure: number;
  impulsiveness: number;
  adaptability: number;
}

export interface EmotionalState {
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

export interface TechnicalAttributes {
  dribbling: number;
  passing: number;
  shooting: number;
  ballControl: number;
  heading: number;
  tackling: number;
  interception: number;
  positioning: number;
  vision: number;
  technique: number;
  firstTouch: number;
  longShots: number;
  penalties: number;
  freeKicks: number;
  curve: number;
}

export interface PhysicalAttributes {
  pace: number;
  acceleration: number;
  stamina: number;
  strength: number;
  agility: number;
  balance: number;
  jumping: number;
  reactions: number;
}

export interface MentalAttributes {
  composure: number;
  concentration: number;
  decisions: number;
  anticipation: number;
  bravery: number;
  determination: number;
  flair: number;
  leadership: number;
  offTheBall: number;
  teamwork: number;
  workRate: number;
  adaptability: number;
}

export interface MatchStats {
  passesAttempted: number;
  passesCompleted: number;
  shotsAttempted: number;
  shotsOnTarget: number;
  goals: number;
  assists: number;
  tacklesAttempted: number;
  tacklesWon: number;
  interceptions: number;
  dribblesAttempted: number;
  dribblesWon: number;
  foulsCommitted: number;
  foulsSuffered: number;
  distanceCovered: number;
}

export interface PlayerState {
  id: number;
  name: string;
  role: PlayerRole;
  teamId: number;
  jerseyNumber: number;

  personality: PersonalityTraits;
  emotions: EmotionalState;
  technical: TechnicalAttributes;
  physical: PhysicalAttributes;
  mental: MentalAttributes;

  position: Vector3D;
  velocity: Vector3D;
  facingDirection: Vector3D;

  hasBall: boolean;
  ballControlQuality: number;

  stamina: number;
  fatigueRate: number;

  stats: MatchStats;

  matchExperience: number;
  form: number;
}

export function createDefaultPersonality(): PersonalityTraits {
  return {
    egoism: 50,
    ambition: 50,
    creativity: 50,
    courage: 50,
    aggressiveness: 50,
    vanity: 50,
    confidence: 50,
    discipline: 50,
    cooperation: 50,
    envy: 50,
    pride: 50,
    competitiveness: 50,
    persistence: 50,
    composure: 50,
    impulsiveness: 50,
    adaptability: 50,
  };
}

export function createDefaultEmotions(): EmotionalState {
  return {
    anger: 0,
    confidence: 50,
    fear: 0,
    frustration: 0,
    euphoria: 0,
    pride: 0,
    anxiety: 0,
    motivation: 50,
    envy: 0,
    determination: 0,
  };
}

export function createDefaultTechnical(): TechnicalAttributes {
  return {
    dribbling: 50,
    passing: 50,
    shooting: 50,
    ballControl: 50,
    heading: 50,
    tackling: 50,
    interception: 50,
    positioning: 50,
    vision: 50,
    technique: 50,
    firstTouch: 50,
    longShots: 50,
    penalties: 50,
    freeKicks: 50,
    curve: 50,
  };
}

export function createDefaultPhysical(): PhysicalAttributes {
  return {
    pace: 50,
    acceleration: 50,
    stamina: 50,
    strength: 50,
    agility: 50,
    balance: 50,
    jumping: 50,
    reactions: 50,
  };
}

export function createDefaultMental(): MentalAttributes {
  return {
    composure: 50,
    concentration: 50,
    decisions: 50,
    anticipation: 50,
    bravery: 50,
    determination: 50,
    flair: 50,
    leadership: 50,
    offTheBall: 50,
    teamwork: 50,
    workRate: 50,
    adaptability: 50,
  };
}

export function createDefaultMatchStats(): MatchStats {
  return {
    passesAttempted: 0,
    passesCompleted: 0,
    shotsAttempted: 0,
    shotsOnTarget: 0,
    goals: 0,
    assists: 0,
    tacklesAttempted: 0,
    tacklesWon: 0,
    interceptions: 0,
    dribblesAttempted: 0,
    dribblesWon: 0,
    foulsCommitted: 0,
    foulsSuffered: 0,
    distanceCovered: 0,
  };
}

export function createPlayer(
  id: number,
  name: string,
  role: PlayerRole,
  teamId: number,
  jerseyNumber: number
): PlayerState {
  return {
    id,
    name,
    role,
    teamId,
    jerseyNumber,
    personality: createDefaultPersonality(),
    emotions: createDefaultEmotions(),
    technical: createDefaultTechnical(),
    physical: createDefaultPhysical(),
    mental: createDefaultMental(),
    position: vec3(0, 0, 0),
    velocity: vec3(0, 0, 0),
    facingDirection: vec3(0, 1, 0),
    hasBall: false,
    ballControlQuality: 1,
    stamina: 100,
    fatigueRate: 0.1,
    stats: createDefaultMatchStats(),
    matchExperience: 0,
    form: 50,
  };
}