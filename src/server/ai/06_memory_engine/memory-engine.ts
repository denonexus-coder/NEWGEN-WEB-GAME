import { PlayerState, PlayerRole } from "../core/types/player";
import { GameEventType } from "../core/types/game-event";
import { Vector3D, vecDistance } from "../core/math/vector3d";
import { AIConfig } from "../core/config";

/**
 * Memory Engine
 *
 * Sistema de memória individual:
 * - Memória de curto prazo (eventos recentes)
 * - Memória de longo prazo (experiências importantes)
 * - Histórico de partidas
 * - Avaliação de experiência
 */

export interface MemoryEvent {
  type: GameEventType;
  timestamp: number;
  position: Vector3D;
  targetPlayerId?: number;
  success: boolean;
  importance: number; // 0-1
  context: string;
}

export interface OpponentRecord {
  opponentId: number;
  confrontations: number;
  successes: number;
  failures: number;
  lastSeen: number;
  evaluation: number; // 0-100 (0=muito fácil, 100=muito difícil)
  notes: string[];
}

export interface ExperienceRecord {
  situation: string;
  action: string;
  outcome: boolean;
  timestamp: number;
  importance: number;
}

export class MemoryEngine {
  private config: AIConfig;

  // Memória de curto prazo (eventos recentes)
  private shortTermMemory: Map<number, MemoryEvent[]> = new Map();

  // Memória de longo prazo (experiências importantes)
  private longTermMemory: Map<number, ExperienceRecord[]> = new Map();

  // Registo de adversários
  private opponentRecords: Map<number, Map<number, OpponentRecord>> = new Map();

  // Histórico de partidas
  private matchHistory: Map<number, MatchRecord[]> = new Map();

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * Regista evento na memória de curto prazo
   */
  recordShortTermEvent(playerId: number, event: MemoryEvent): void {
    if (!this.shortTermMemory.has(playerId)) {
      this.shortTermMemory.set(playerId, []);
    }

    const memory = this.shortTermMemory.get(playerId)!;
    memory.push(event);

    // Manter apenas últimos N eventos
    if (memory.length > this.config.shortTermMemorySize) {
      memory.shift();
    }
  }

  /**
   * Regista experiência na memória de longo prazo
   */
  recordLongTermExperience(playerId: number, experience: ExperienceRecord): void {
    if (!this.longTermMemory.has(playerId)) {
      this.longTermMemory.set(playerId, []);
    }

    const memory = this.longTermMemory.get(playerId)!;
    memory.push(experience);

    // Manter apenas últimos N experiências
    if (memory.length > this.config.longTermMemorySize) {
      memory.shift();
    }
  }

  /**
   * Regista confronto com adversário
   */
  recordOpponentConfrontation(
    playerId: number,
    opponentId: number,
    success: boolean,
    timestamp: number
  ): void {
    if (!this.opponentRecords.has(playerId)) {
      this.opponentRecords.set(playerId, new Map());
    }

    const records = this.opponentRecords.get(playerId)!;
    let record = records.get(opponentId);

    if (!record) {
      record = {
        opponentId,
        confrontations: 0,
        successes: 0,
        failures: 0,
        lastSeen: timestamp,
        evaluation: 50,
        notes: [],
      };
      records.set(opponentId, record);
    }

    record.confrontations++;
    if (success) {
      record.successes++;
    } else {
      record.failures++;
    }
    record.lastSeen = timestamp;

    // Atualizar avaliação
    record.evaluation = (record.failures / record.confrontations) * 100;

    // Adicionar nota se falhou muitas vezes
    if (record.failures >= 3 && record.successes === 0) {
      record.notes.push("Difícil de ultrapassar");
    }
  }

  /**
   * Obtém memória de curto prazo
   */
  getShortTermMemory(playerId: number): MemoryEvent[] {
    return this.shortTermMemory.get(playerId) || [];
  }

  /**
   * Obtém memória de longo prazo
   */
  getLongTermMemory(playerId: number): ExperienceRecord[] {
    return this.longTermMemory.get(playerId) || [];
  }

  /**
   * Obtém registo de adversário
   */
  getOpponentRecord(playerId: number, opponentId: number): OpponentRecord | null {
    const records = this.opponentRecords.get(playerId);
    if (!records) return null;
    return records.get(opponentId) || null;
  }

  /**
   * Obtém todos os registo de adversários de um jogador
   */
  getAllOpponentRecords(playerId: number): OpponentRecord[] {
    const records = this.opponentRecords.get(playerId);
    if (!records) return [];
    return Array.from(records.values());
  }

  /**
   * Verifica se jogador já falhou contra adversário
   */
  hasFailedAgainst(playerId: number, opponentId: number, threshold: number = 3): boolean {
    const record = this.getOpponentRecord(playerId, opponentId);
    if (!record) return false;
    return record.failures >= threshold && record.successes === 0;
  }

  /**
   * Obtém dificuldade de adversário (0-100)
   */
  getOpponentDifficulty(playerId: number, opponentId: number): number {
    const record = this.getOpponentRecord(playerId, opponentId);
    if (!record) return 50; // Neutro
    return record.evaluation;
  }

  /**
   * Obtém eventos recentes que são importantes
   */
  getImportantRecentEvents(playerId: number, minImportance: number = 0.7): MemoryEvent[] {
    return this.getShortTermMemory(playerId).filter(
      (event) => event.importance >= minImportance
    );
  }

  /**
   * Verifica se jogador falhou recentemente
   */
  hasRecentFailure(playerId: number, eventTypes: GameEventType[]): boolean {
    const recent = this.getShortTermMemory(playerId);
    return recent.some(
      (event) => eventTypes.includes(event.type) && !event.success
    );
  }

  /**
   * Conta falhas recentes de um tipo específico
   */
  countRecentFailures(playerId: number, eventType: GameEventType, windowSize: number = 5): number {
    const recent = this.getShortTermMemory(playerId);
    const lastEvents = recent.slice(-windowSize);
    return lastEvents.filter((e) => e.type === eventType && !e.success).length;
  }

  /**
   * Obtém estatísticas de memória
   */
  getMemoryStats(playerId: number): {
    shortTermCount: number;
    longTermCount: number;
    opponentCount: number;
    averageImportance: number;
  } {
    const shortTerm = this.getShortTermMemory(playerId);
    const longTerm = this.getLongTermMemory(playerId);
    const opponents = this.getAllOpponentRecords(playerId);

    const avgImportance = shortTerm.length > 0
      ? shortTerm.reduce((sum, e) => sum + e.importance, 0) / shortTerm.length
      : 0;

    return {
      shortTermCount: shortTerm.length,
      longTermCount: longTerm.length,
      opponentCount: opponents.length,
      averageImportance: avgImportance,
    };
  }

  /**
   * Limpa memória de um jogador
   */
  clearPlayerMemory(playerId: number): void {
    this.shortTermMemory.delete(playerId);
    this.longTermMemory.delete(playerId);
    this.opponentRecords.delete(playerId);
    this.matchHistory.delete(playerId);
  }

  /**
   * Limpa toda a memória
   */
  clearAllMemory(): void {
    this.shortTermMemory.clear();
    this.longTermMemory.clear();
    this.opponentRecords.clear();
    this.matchHistory.clear();
  }
}

// ==================== TIPOS AUXILIARES ====================

export interface MatchRecord {
  matchId: number;
  opponentTeam: number;
  date: number;
  result: "win" | "loss" | "draw";
  goalsScored: number;
  assists: number;
  keyMoments: string[];
  performance: number; // 0-100
}