import { PlayerRole } from "../core/types/player";

/**
 * Sistema de Formações Táticas
 *
 * As formações definem as posições esperadas de cada jogador.
 * A maioria dos jogadores respeita estas posições.
 */

export interface FormationSlot {
  role: PlayerRole;
  x: number; // 0-100 (0 = baliza própria, 100 = baliza adversária)
  y: number; // 0-65 (0 = linha lateral esquerda, 65 = linha lateral direita)
}

export class TacticalFormation {
  name: string;
  slots: FormationSlot[];

  constructor(name: string, slots: FormationSlot[]) {
    this.name = name;
    this.slots = slots;
  }

  getPositionForRole(role: PlayerRole): { x: number; y: number } | null {
    const slot = this.slots.find((s) => s.role === role);
    if (slot) {
      return { x: slot.x, y: slot.y };
    }
    return null;
  }

  /**
   * Retorna todas as posições para uma formação completa
   */
  getAllPositions(): FormationSlot[] {
    return [...this.slots];
  }

  /**
   * Verifica se a formação está correta (11 jogadores)
   */
  isValid(): boolean {
    return this.slots.length === 11;
  }
}

// ==================== FORMAÇÕES PADRÃO ====================

/**
 * Formação 4-4-2 - Equilibrada
 * Posições em campo (x: 0-100, y: 0-65)
 */
export function create442(): TacticalFormation {
  return new TacticalFormation("4-4-2", [
    // Goleiro
    { role: PlayerRole.Goalkeeper, x: 5, y: 32.5 },

    // Defesa (4)
    { role: PlayerRole.DefenderLeft, x: 20, y: 15 },
    { role: PlayerRole.DefenderCenter, x: 18, y: 28 },
    { role: PlayerRole.DefenderCenter, x: 18, y: 37 },
    { role: PlayerRole.DefenderRight, x: 20, y: 50 },

    // Meio-campo (4)
    { role: PlayerRole.MidfielderDefensive, x: 35, y: 32.5 },
    { role: PlayerRole.MidfielderCenter, x: 45, y: 22 },
    { role: PlayerRole.WingerLeft, x: 50, y: 10 },
    { role: PlayerRole.WingerRight, x: 50, y: 55 },

    // Ataque (2)
    { role: PlayerRole.Striker, x: 75, y: 28 },
    { role: PlayerRole.StrikerSecond, x: 72, y: 37 },
  ]);
}

/**
 * Formação 4-3-3 - Ofensiva
 */
export function create433(): TacticalFormation {
  return new TacticalFormation("4-3-3", [
    { role: PlayerRole.Goalkeeper, x: 5, y: 32.5 },

    { role: PlayerRole.DefenderLeft, x: 20, y: 15 },
    { role: PlayerRole.DefenderCenter, x: 18, y: 28 },
    { role: PlayerRole.DefenderCenter, x: 18, y: 37 },
    { role: PlayerRole.DefenderRight, x: 20, y: 50 },

    { role: PlayerRole.MidfielderDefensive, x: 35, y: 32.5 },
    { role: PlayerRole.MidfielderCenter, x: 45, y: 20 },
    { role: PlayerRole.MidfielderAttacking, x: 55, y: 45 },

    { role: PlayerRole.WingerLeft, x: 70, y: 12 },
    { role: PlayerRole.Striker, x: 78, y: 32.5 },
    { role: PlayerRole.WingerRight, x: 70, y: 53 },
  ]);
}

/**
 * Formação 3-5-2 - Controle de meio-campo
 */
export function create352(): TacticalFormation {
  return new TacticalFormation("3-5-2", [
    { role: PlayerRole.Goalkeeper, x: 5, y: 32.5 },

    { role: PlayerRole.DefenderCenter, x: 18, y: 22 },
    { role: PlayerRole.DefenderCenter, x: 16, y: 32.5 },
    { role: PlayerRole.DefenderCenter, x: 18, y: 43 },

    { role: PlayerRole.DefenderLeft, x: 40, y: 8 },
    { role: PlayerRole.MidfielderDefensive, x: 38, y: 32.5 },
    { role: PlayerRole.MidfielderCenter, x: 48, y: 25 },
    { role: PlayerRole.MidfielderAttacking, x: 55, y: 40 },
    { role: PlayerRole.DefenderRight, x: 40, y: 57 },

    { role: PlayerRole.Striker, x: 75, y: 28 },
    { role: PlayerRole.StrikerSecond, x: 72, y: 37 },
  ]);
}

/**
 * Formação 5-3-2 - Defensiva
 */
export function create532(): TacticalFormation {
  return new TacticalFormation("5-3-2", [
    { role: PlayerRole.Goalkeeper, x: 5, y: 32.5 },

    { role: PlayerRole.DefenderLeft, x: 25, y: 8 },
    { role: PlayerRole.DefenderCenter, x: 18, y: 22 },
    { role: PlayerRole.DefenderCenter, x: 16, y: 32.5 },
    { role: PlayerRole.DefenderCenter, x: 18, y: 43 },
    { role: PlayerRole.DefenderRight, x: 25, y: 57 },

    { role: PlayerRole.MidfielderDefensive, x: 35, y: 32.5 },
    { role: PlayerRole.MidfielderCenter, x: 45, y: 22 },
    { role: PlayerRole.MidfielderAttacking, x: 50, y: 43 },

    { role: PlayerRole.Striker, x: 72, y: 28 },
    { role: PlayerRole.StrikerSecond, x: 70, y: 37 },
  ]);
}

/**
 * Formação 4-2-3-1 - Moderna
 */
export function create4231(): TacticalFormation {
  return new TacticalFormation("4-2-3-1", [
    { role: PlayerRole.Goalkeeper, x: 5, y: 32.5 },

    { role: PlayerRole.DefenderLeft, x: 20, y: 15 },
    { role: PlayerRole.DefenderCenter, x: 18, y: 28 },
    { role: PlayerRole.DefenderCenter, x: 18, y: 37 },
    { role: PlayerRole.DefenderRight, x: 20, y: 50 },

    { role: PlayerRole.MidfielderDefensive, x: 32, y: 27 },
    { role: PlayerRole.MidfielderDefensive, x: 32, y: 38 }, // Precisa de role diferente

    { role: PlayerRole.WingerLeft, x: 55, y: 12 },
    { role: PlayerRole.MidfielderAttacking, x: 55, y: 32.5 },
    { role: PlayerRole.WingerRight, x: 55, y: 53 },

    { role: PlayerRole.Striker, x: 78, y: 32.5 },
  ]);
}

// ==================== SISTEMA DE FORMAÇÃO ====================

export class FormationSystem {
  private currentFormation: TacticalFormation;
  private playerRoles: Map<number, PlayerRole> = new Map();

  constructor(formation?: TacticalFormation) {
    this.currentFormation = formation || create442();
  }

  setFormation(formation: TacticalFormation): void {
    this.currentFormation = formation;
  }

  getFormation(): TacticalFormation {
    return this.currentFormation;
  }

  /**
   * Atribui posições aos jogadores baseado na formação
   */
  assignPositions(players: Array<{ id: number; role: PlayerRole }>): Map<number, { x: number; y: number }> {
    const positions = new Map<number, { x: number; y: number }>();

    for (const player of players) {
      const pos = this.currentFormation.getPositionForRole(player.role);
      if (pos) {
        positions.set(player.id, pos);
        this.playerRoles.set(player.id, player.role);
      } else {
        // Fallback: posição central
        positions.set(player.id, { x: 50, y: 32.5 });
      }
    }

    return positions;
  }

  /**
   * Retorna a posição tática esperada para um jogador
   */
  getExpectedPosition(playerId: number): { x: number; y: number } | null {
    const role = this.playerRoles.get(playerId);
    if (!role) return null;
    return this.currentFormation.getPositionForRole(role);
  }

  /**
   * Calcula a distância de um jogador à sua posição tática
   */
  getDistanceFromPosition(
    playerId: number,
    currentPosition: { x: number; y: number }
  ): number {
    const expected = this.getExpectedPosition(playerId);
    if (!expected) return 0;

    const dx = currentPosition.x - expected.x;
    const dy = currentPosition.y - expected.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Verifica se um jogador está fora de posição
   */
  isOutOfPosition(
    playerId: number,
    currentPosition: { x: number; y: number },
    tolerance: number = 15
  ): boolean {
    const distance = this.getDistanceFromPosition(playerId, currentPosition);
    return distance > tolerance;
  }

  /**
   * Retorna a formação como string para exibição
   */
  getFormationString(): string {
    const roleCounts = new Map<PlayerRole, number>();

    for (const slot of this.currentFormation.slots) {
      roleCounts.set(slot.role, (roleCounts.get(slot.role) || 0) + 1);
    }

    // Simplificado: retorna nome da formação
    return this.currentFormation.name;
  }
}