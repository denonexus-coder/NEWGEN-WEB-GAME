export type TeamType = 'NEWGEN' | 'NEWEGOISTS';

export type PlayerRole = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface FormationPosition {
  role: PlayerRole;
  x: number; // normalized field position: -50 (own goal) to 50 (opponent goal)
  z: number; // normalized field position: -32 (left touchline) to 32 (right touchline)
  label: string;
}

export interface PlayerData {
  id: number;
  name: string;
  number: number;
  team: TeamType;
  role: PlayerRole;
  basePosition: { x: number; z: number };
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  rotation: number;
  speed: number;
  stamina: number;
  maxSpeed: number;
  kickPower: number;
  isControllable: boolean;
  isGoalkeeper: boolean;
  state: 'idle' | 'running' | 'sprinting' | 'kicking' | 'tackling' | 'diving' | 'celebrating';
  animTime: number;
  hairColor: string;
  skinTone: string;
}

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinZ: number;
  radius: number;
  lastTouchedByTeam: TeamType | null;
  lastTouchedPlayerId: number | null;
  isInNet: boolean;
}

export type MatchPeriod = '1ST_HALF' | 'HALF_TIME' | '2ND_HALF' | 'FULL_TIME';

export type GameState = 'MENU' | 'COUNTDOWN' | 'PLAYING' | 'GOAL_CELEBRATION' | 'OUT_OF_BOUNDS' | 'HALF_TIME_BREAK' | 'GAME_OVER' | 'PAUSED';

export type CameraMode = 'BROADCAST' | 'ACTION' | 'TACTICAL';

export type AIDifficulty = 'BEGINNER' | 'SEMI_PRO' | 'EGOIST_LEGEND';

export interface MatchStats {
  score: {
    NEWGEN: number;
    NEWEGOISTS: number;
  };
  possession: {
    NEWGEN: number;
    NEWEGOISTS: number;
  };
  shots: {
    NEWGEN: number;
    NEWEGOISTS: number;
  };
  shotsOnTarget: {
    NEWGEN: number;
    NEWEGOISTS: number;
  };
  passes: {
    NEWGEN: number;
    NEWEGOISTS: number;
  };
  tackles: {
    NEWGEN: number;
    NEWEGOISTS: number;
  };
  goals: Array<{
    team: TeamType;
    scorerName: string;
    scorerNumber: number;
    minute: number;
  }>;
}

export interface VirtualInput {
  joystick: {
    x: number; // -1 to 1
    y: number; // -1 to 1
    active: boolean;
    distance: number; // 0 to 1
  };
  pass: boolean;
  shoot: boolean;
  shootPower: number; // 0 to 1 charged
  sprint: boolean;
  switchPlayer: boolean;
  tackle: boolean;
}
