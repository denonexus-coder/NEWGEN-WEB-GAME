import { PlayerState, PlayerRole } from "../core/types/player";
import { GameEventType } from "../core/types/game-event";
import { Vector3D, vec3, vecDistance, vecLength } from "../core/math/vector3d";
import { AIConfig } from "../core/config";
import { MemoryEngine } from "../06_memory_engine/memory-engine";

/**
 * Rivalry Engine
 *
 * Sistema de rivalidades individuais:
 * - Identificação de inimigos
 * - Rastreamento de rivalidades
 * - Comportamento competitivo
 * - Relações sociais
 */

export type RelationshipType = "rivalry" | "friendship" | "neutral" | "hostility";

export interface RivalryRecord {
  opponentId: number;
  intensity: number; // 0-100
  confrontations: number;
  wins: number;
  losses: number;
  lastEncounter: number;
  grudge: number; // 0-100
  respect: number; // 0-100
}

export interface SocialRelationship {
  playerId: number;
  type: RelationshipType;
  strength: number; // 0-100
  history: string[];
}

export class RivalryEngine {
  private config: AIConfig;
  private memoryEngine: MemoryEngine;

  // Rivalidades por jogador
  private rivalries: Map<number, Map<number, RivalryRecord>> = new Map();

  // Relações sociais
  private relationships: Map<number, Map<number, SocialRelationship>> = new Map();

  constructor(config: AIConfig, memoryEngine: MemoryEngine) {
    this.config = config;
    this.memoryEngine = memoryEngine;
  }

  /**
   * Regista confronto entre jogadores
   */
  recordEncounter(
    playerId: number,
    opponentId: number,
    event: GameEvent,
    timestamp: number
  ): void {
    // Inicializar se necessário
    if (!this.rivalries.has(playerId)) {
      this.rivalries.set(playerId, new Map());
    }

    const rivalries = this.rivalries.get(playerId)!;
    let rivalry = rivalries.get(opponentId);

    if (!rivalry) {
      rivalry = {
        opponentId,
        intensity: 0,
        confrontations: 0,
        wins: 0,
        losses: 0,
        lastEncounter: timestamp,
        grudge: 0,
        respect: 50,
      };
      rivalries.set(opponentId, rivalry);
    }

    // Atualizar estatísticas
    rivalry.confrontations++;
    rivalry.lastEncounter = timestamp;

    // Determinar resultado
    if (event.type === GameEventType.DribbleWon || event.type === GameEventType.TackleWon) {
      rivalry.wins++;
      rivalry.intensity = Math.min(100, rivalry.intensity + 10);
      rivalry.respect = Math.min(100, rivalry.respect + 5);
    } else if (event.type === GameEventType.DribbleLost || event.type === GameEventType.TackleLost) {
      rivalry.losses++;
      rivalry.intensity = Math.min(100, rivalry.intensity + 15);
      rivalry.grudge = Math.min(100, rivalry.grudge + 10);
      rivalry.respect = Math.max(0, rivalry.respect - 5);
    }

    // Calcular intensidade baseada em confrontos
    if (rivalry.confrontations >= 3) {
      rivalry.intensity = Math.min(100, rivalry.intensity + (rivalry.confrontations * 2));
    }

    // Atualizar memória
    this.memoryEngine.recordOpponentConfrontation(
      playerId,
      opponentId,
      event.type === GameEventType.DribbleWon || event.type === GameEventType.TackleWon,
      timestamp
    );
  }

  /**
   * Obtém rivalidade entre jogadores
   */
  getRivalry(playerId: number, opponentId: number): RivalryRecord | null {
    const rivalries = this.rivalries.get(playerId);
    if (!rivalries) return null;
    return rivalries.get(opponentId) || null;
  }

  /**
   * Obtém todas as rivalidades de um jogador
   */
  getAllRivalries(playerId: number): RivalryRecord[] {
    const rivalries = this.rivalries.get(playerId);
    if (!rivalries) return [];
    return Array.from(rivalries.values());
  }

  /**
   * Obtém rival mais intenso
   * Critérios: intensidade, depois nº de confrontos, depois rancor
   */
  getArchRival(playerId: number): RivalryRecord | null {
    const rivalries = this.getAllRivalries(playerId);
    if (rivalries.length === 0) return null;

    return rivalries.reduce((best, r) => {
      if (r.intensity !== best.intensity) return r.intensity > best.intensity ? r : best;
      if (r.confrontations !== best.confrontations)
        return r.confrontations > best.confrontations ? r : best;
      return r.grudge > best.grudge ? r : best;
    });
  }

  /**
   * Verifica se jogador tem rivalidade com outro
   */
  hasRivalry(playerId: number, opponentId: number, minIntensity: number = 50): boolean {
    const rivalry = this.getRivalry(playerId, opponentId);
    if (!rivalry) return false;
    return rivalry.intensity >= minIntensity;
  }

  /**
   * Calcula intensidade de rivalidade para situação atual
   */
  calculateRivalryIntensity(
    playerId: number,
    opponentId: number,
    context: EncounterContext
  ): number {
    const rivalry = this.getRivalry(playerId, opponentId);
    if (!rivalry) return 0;

    let intensity = rivalry.intensity;

    // Grudge aumenta
    intensity += rivalry.grudge * 0.3;

    // Respeito diminui (jogadores respeitados são mais calmos)
    intensity -= rivalry.respect * 0.2;

    // Contexto atual
    if (context.isImportantMatch) intensity += 20;
    if (context.isFinalThird) intensity += 10;
    if (context.hasBall) intensity += 15;

    return Math.max(0, Math.min(100, intensity));
  }

  /**
   * Obtém comportamento recomendado baseado em rivalidade
   */
  getRecommendedBehavior(
    playerId: number,
    opponentId: number,
    playerPersonality: PlayerState["personality"]
  ): RivalryBehavior {
    const rivalry = this.getRivalry(playerId, opponentId);
    if (!rivalry) return "neutral";

    const intensity = rivalry.intensity;
    const grudge = rivalry.grudge;
    const competitiveness = playerPersonality.competitiveness;
    const discipline = playerPersonality.discipline;

    // Alto grudge + alta competitividade = agressivo
    if (grudge > 70 && competitiveness > 70) {
      return "aggressive";
    }

    // Alta intensidade + baixa disciplina = arriscado
    if (intensity > 60 && discipline < 50) {
      return "risky";
    }

    // Média intensidade + alta disciplina = focado
    if (intensity > 40 && discipline > 60) {
      return "focused";
    }

    // Alto respeito = respeitoso
    if (rivalry.respect > 70) {
      return "respectful";
    }

    return "neutral";
  }

  /**
   * Regista relação social
   */
  recordRelationship(
    playerId: number,
    otherId: number,
    type: RelationshipType,
    event: string
  ): void {
    if (!this.relationships.has(playerId)) {
      this.relationships.set(playerId, new Map());
    }

    const relationships = this.relationships.get(playerId)!;
    let relationship = relationships.get(otherId);

    if (!relationship) {
      relationship = {
        playerId: otherId,
        type,
        strength: 50,
        history: [],
      };
      relationships.set(otherId, relationship);
    }

    // Atualizar tipo se necessário
    if (relationship.type !== type) {
      relationship.type = type;
    }

    // Aumentar força
    relationship.strength = Math.min(100, relationship.strength + 10);

    // Registrar evento
    relationship.history.push(event);
    if (relationship.history.length > 10) {
      relationship.history.shift();
    }
  }

  /**
   * Obtém relação social
   */
  getRelationship(playerId: number, otherId: number): SocialRelationship | null {
    const relationships = this.relationships.get(playerId);
    if (!relationships) return null;
    return relationships.get(otherId) || null;
  }

  /**
   * Obtém todas as relações de um jogador
   */
  getAllRelationships(playerId: number): SocialRelationship[] {
    const relationships = this.relationships.get(playerId);
    if (!relationships) return [];
    return Array.from(relationships.values());
  }

  /**
   * Verifica se jogadores são aliados
   */
  areAllies(playerId: number, otherId: number): boolean {
    const relationship = this.getRelationship(playerId, otherId);
    if (!relationship) return false;
    return relationship.type === "friendship" && relationship.strength > 60;
  }

  /**
   * Verifica se jogadores são rivais
   */
  areRivals(playerId: number, otherId: number): boolean {
    return this.hasRivalry(playerId, otherId, 50);
  }

  /**
   * Obtém estatísticas de rivalidade
   */
  getRivalryStats(playerId: number): {
    totalRivalries: number;
    intenseRivalries: number;
    averageIntensity: number;
    topRival: RivalryRecord | null;
  } {
    const rivalries = this.getAllRivalries(playerId);

    const intense = rivalries.filter((r) => r.intensity > 70);
    const avgIntensity = rivalries.length > 0
      ? rivalries.reduce((sum, r) => sum + r.intensity, 0) / rivalries.length
      : 0;

    const topRival = this.getArchRival(playerId);

    return {
      totalRivalries: rivalries.length,
      intenseRivalries: intense.length,
      averageIntensity: avgIntensity,
      topRival,
    };
  }
}

// ==================== TIPOS AUXILIARES ====================

export type RivalryBehavior = "aggressive" | "risky" | "focused" | "respectful" | "neutral";

export interface GameEvent {
  type: GameEventType;
  playerId: number;
  targetPlayerId?: number;
  success: boolean;
}

export interface EncounterContext {
  isImportantMatch: boolean;
  isFinalThird: boolean;
  hasBall: boolean;
  timeRemaining: number;
}