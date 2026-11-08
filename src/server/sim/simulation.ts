import { PlayerState, PlayerRole } from "../ai/core/types/player";
import { BallState, createBallState } from "../ai/core/types/ball";
import { createFieldState, FieldState } from "../ai/core/types/field";
import { Vector3D, vec3, vecDistance } from "../ai/core/math/vector3d";
import { AIConfig, createDefaultAIConfig } from "../ai/core/config";
import { GameEventType } from "../ai/core/types/game-event";
import { DecisionEngine, GameContext as DecisionGameContext } from "../ai/04_decision_engine/decision-engine";
import { CreativeEngine, CreativeContext, CreativeOption } from "../ai/05_creative_engine/creative-engine";
import { EmotionEngine } from "../ai/03_emotion_engine/emotion-engine";
import { PersonalityEngine, GameContext as PersonalityGameContext } from "../ai/02_personality_engine/personality-engine";
import { BehaviorEngine, BehaviorCommand } from "../ai/12_behavior_execution/behavior-engine";
import { GoalkeeperAI, GoalkeeperContext } from "../ai/11_goalkeeper_ai/goalkeeper-ai";
import { TacticalEngine } from "../ai/09_tactical_engine/tactical-engine";
import { MemoryEngine, MemoryEvent } from "../ai/06_memory_engine/memory-engine";
import { RivalryEngine, GameEvent as RivalryGameEvent } from "../ai/08_rivalry_engine/rivalry-engine";
import { TournamentTeam, isForwardRole } from "./teams";

/**
 * Torneio - Simulador de Jogos
 *
 * 11v11 em campo 100x65, dt=0.5s, com os 12 motores reais:
 * - Decision Engine escolhe a ação do portador da bola
 * - Creative Engine oferece jogadas criativas (raras)
 * - Behavior Engine executa (passe/remate/drible/portão de showboating)
 * - Tactical Engine posiciona a equipa por fase (posse/defesa)
 * - Goalkeeper AI posiciona-se, defende e distribui
 * - Emotion/Memory/Rivalry reagem aos eventos
 */

export interface TeamMatchStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  shotsBlocked: number;
  saves: number;
  passesAttempted: number;
  passesCompleted: number;
  possessionTicks: number;
  dribblesAttempted: number;
  dribblesWon: number;
  tacklesWon: number;
  interceptions: number;
  skillMoves: number;
  onBallActions: number;
  formationDeviationSum: number;
  formationDeviationSamples: number;
  /** Histograma de ações: pass/shoot/dribble/hold/move/gk... */
  actionCounts: Record<string, number>;
}

export function emptyStats(): TeamMatchStats {
  return {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    shotsBlocked: 0,
    saves: 0,
    passesAttempted: 0,
    passesCompleted: 0,
    possessionTicks: 0,
    dribblesAttempted: 0,
    dribblesWon: 0,
    tacklesWon: 0,
    interceptions: 0,
    skillMoves: 0,
    onBallActions: 0,
    formationDeviationSum: 0,
    formationDeviationSamples: 0,
    actionCounts: {},
  };
}

export interface MatchResult {
  homeId: number;
  awayId: number;
  homeShort: string;
  awayShort: string;
  homeGoals: number;
  awayGoals: number;
  home: TeamMatchStats;
  away: TeamMatchStats;
  goalLog: string[];
  ticks: number;
  wallMs: number;
}

/** Eventos estruturados do jogo (para hosts/client) */
export interface MatchEvent {
  t: number;
  type: "goal" | "shot" | "save" | "kickoff" | "halftime" | "fulltime";
  team?: 1 | 2;
  outcome?: "goal" | "save" | "miss" | "blocked";
  player?: string;
  scoreHome?: number;
  scoreAway?: number;
}

/**
 * Estado exposto por cada tick do gerador runMatch.
 * As referências (ball, players, stats) são VIVAS — consumir imediatamente
 * (o host copia para Float32Array no momento do yield).
 */
export interface TickState {
  time: number;
  ticks: number;
  scoreHome: number;
  scoreAway: number;
  possession: 1 | 2;
  ball: BallState;
  home: PlayerState[];
  away: PlayerState[];
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  events: MatchEvent[];
  /** true = bola em voo (física); false = colada ao portador */
  ballInFlight: boolean;
}

/**
 * Adaptador de física da bola (opcional).
 *
 * Sem adaptador → comportamento clássico (teleporte de posse), idêntico
 * aos benchmarks do laboratório.
 * Com adaptador → passes e remates voam (gravidade/quique/arrasto) e os
 * jogadores separam-se (colisão suave). As probabilidades dos engines
 * continuam a mandar nos resultados.
 */
export interface BallPhysicsAdapter {
  /** Impulso: bola voa até `target` (ref viva segue o alvo) a `speed` m/s; `loft` = vz inicial */
  kick(ball: BallState, target: Vector3D | null, speed: number, loft: number): void;
  /** Integra dt; `homing` corrige a direção para alvo vivo; true = voo terminou (chegou/parou/saiu) */
  step(ball: BallState, dt: number, homing: Vector3D | null): boolean;
  /** Cola a bola a uma posição (posse retomada) */
  attach(ball: BallState, pos: Vector3D): void;
  /** Separa jogadores sobrepostos (colisão suave, raio ~0.45m cada) */
  separate(players: PlayerState[]): void;
}

export interface EngineBundle {
  config: AIConfig;
  decision: DecisionEngine;
  creative: CreativeEngine;
  emotion: EmotionEngine;
  personality: PersonalityEngine;
  behavior: BehaviorEngine;
  gk: GoalkeeperAI;
  memory: MemoryEngine;
  rivalry: RivalryEngine;
}

export function createEngineBundle(): EngineBundle {
  const config = createDefaultAIConfig();
  const personality = new PersonalityEngine(config);
  const emotion = new EmotionEngine(config);
  const memory = new MemoryEngine(config);
  return {
    config,
    personality,
    emotion,
    memory,
    decision: new DecisionEngine(config, personality, emotion),
    creative: new CreativeEngine(config, personality, emotion),
    behavior: new BehaviorEngine(config, undefined, personality),
    gk: new GoalkeeperAI(),
    rivalry: new RivalryEngine(config, memory),
  };
}

interface TeamRT {
  team: TournamentTeam;
  teamId: 1 | 2;
  players: PlayerState[];
  stats: TeamMatchStats;
  tactical: TacticalEngine;
  gkTarget: Vector3D;
  gkIdx: number;
}

export class MatchSimulator {
  private e: EngineBundle;
  private field: FieldState;
  private physics?: BallPhysicsAdapter;

  constructor(e: EngineBundle, physics?: BallPhysicsAdapter) {
    this.e = e;
    this.physics = physics;
    this.field = createFieldState();
  }

  /** Corre a partida inteira (API dos benchmarks) */
  simulate(home: TournamentTeam, away: TournamentTeam, minutes = 90): MatchResult {
    const it = this.runMatch(home, away, minutes);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  }

  /**
   * Gerador de partida — avança tick a tick para hosts em tempo real.
   * Cada yield devolve TickState com referências VIVAS (ler já!).
   * `dt` fixo (0.5 = modo torneio; 0.05 = tempo real).
   */
  *runMatch(
    home: TournamentTeam,
    away: TournamentTeam,
    minutes = 90,
    dt = 0.5
  ): Generator<TickState, MatchResult, void> {
    const wallStart = performance.now();
    const physics = this.physics;
    const totalSeconds = minutes * 60;
    const e = this.e;
    const field = this.field;

    // Mapeamento de equipas: casa=1 (ataca +x), fora=2 (ataca -x)
    home.players.forEach((p) => (p.teamId = 1));
    away.players.forEach((p) => (p.teamId = 2));

    const homeRT: TeamRT = {
      team: home,
      teamId: 1,
      players: home.players,
      stats: emptyStats(),
      tactical: new TacticalEngine(e.config),
      gkTarget: vec3(2, 32.5, 0),
      gkIdx: home.players.findIndex((p) => p.role === PlayerRole.Goalkeeper),
    };
    const awayRT: TeamRT = {
      team: away,
      teamId: 2,
      players: away.players,
      stats: emptyStats(),
      tactical: new TacticalEngine(e.config),
      gkTarget: vec3(98, 32.5, 0),
      gkIdx: away.players.findIndex((p) => p.role === PlayerRole.Goalkeeper),
    };
    homeRT.tactical.setFormation(home.profile.formation);
    awayRT.tactical.setFormation(away.profile.formation);

    const ball = createBallState();
    const score: Record<1 | 2, number> = { 1: 0, 2: 0 };
    const goalLog: string[] = [];
    const events: MatchEvent[] = [];

    let time = 0;
    let ticks = 0;
    let possession: 1 | 2 = Math.random() < 0.5 ? 1 : 2;
    let carrierRT: TeamRT | null = null;
    let carrierIdx = -1;
    let carrierTarget: Vector3D | null = null;
    let decisionCooldown = 1;
    let gkDecideCooldown = 0;
    let devCooldown = 0;

    const rtOf = (tid: 1 | 2): TeamRT => (tid === 1 ? homeRT : awayRT);
    const otherRT = (rt: TeamRT): TeamRT => (rt === homeRT ? awayRT : homeRT);
    const localX = (tid: 1 | 2, x: number): number => (tid === 1 ? x : 100 - x);
    const goalXOf = (tid: 1 | 2): number => (tid === 1 ? 100 : 0);

    const carrierPlayer = (): PlayerState | null =>
      carrierRT ? carrierRT.players[carrierIdx] : null;

    function setCarrier(rt: TeamRT, idx: number): void {
      const prev = carrierPlayer();
      if (prev) prev.hasBall = false;
      carrierRT = rt;
      carrierIdx = idx;
      carrierTarget = null;
      const p = rt.players[idx];
      p.hasBall = true;
      possession = rt.teamId;
    }

    // ---- Voo da bola (física opcional) ----
    type Flight = {
      /** alvo vivo (ref do Vector3D) ou null = linha reta até sair */
      homing: Vector3D | null;
      timeout: number;
      /** golo: reinício adiado até a bola chegar à rede */
      pendingKickoff: 1 | 2 | null;
    };
    let flight: Flight | null = null;
    /** Lê o estado de voo com o tipo declarado (o CFA do TS não segue atribuições em closures) */
    const getFlight = (): Flight | null => flight;

    /** Velocidade de passe realista para a distância (chega em ~0.7s) */
    const passSpeed = (d: number): number => Math.max(14, Math.min(28, d / 0.7));

    /**
     * Inicia o voo da bola até `target` (referência viva segue o alvo).
     * Sem adaptador de física é no-op → comportamento clássico (teleporte).
     */
    function startFlight(
      target: Vector3D | null,
      speed: number,
      timeout: number,
      loft = 0,
      pendingKickoff: 1 | 2 | null = null
    ): void {
      if (!physics) return;
      physics.kick(ball, target, speed, loft);
      flight = { homing: target, timeout, pendingKickoff };
    }

    // ---- Scratch para chamadas táticas do time 2 (frame local espelhado) ----
    const scratchSelf = away.players.map((p) =>
      ({ role: p.role, position: vec3(0, 0, 0) } as unknown as PlayerState)
    );
    const scratchOpp = home.players.map((p) =>
      ({ role: p.role, position: vec3(0, 0, 0) } as unknown as PlayerState)
    );
    const scratchBall = { position: vec3(0, 0, 0) } as BallState;

    function fillScratch(): void {
      away.players.forEach((p, i) => {
        scratchSelf[i].position.x = 100 - p.position.x;
        scratchSelf[i].position.y = p.position.y;
      });
      home.players.forEach((p, i) => {
        scratchOpp[i].position.x = 100 - p.position.x;
        scratchOpp[i].position.y = p.position.y;
      });
      scratchBall.position.x = 100 - ball.position.x;
      scratchBall.position.y = ball.position.y;
    }

    /** Posição tática ideal (frame global) para jogador idx */
    function tacticalTarget(rt: TeamRT, idx: number): Vector3D {
      if (rt.teamId === 1) {
        const ideal = rt.tactical.calculateIdealPosition(
          rt.team.players[idx],
          ball,
          home.players,
          away.players
        );
        return ideal.position;
      }
      const ideal = rt.tactical.calculateIdealPosition(
        scratchSelf[idx],
        scratchBall,
        scratchSelf,
        scratchOpp
      );
      return vec3(100 - ideal.position.x, ideal.position.y, 0);
    }

    function gkContext(rt: TeamRT): GoalkeeperContext {
      return {
        goalkeeper: rt.players[rt.gkIdx],
        ball,
        teammates: rt.players,
        opponents: otherRT(rt).players,
        field,
      };
    }

    // ---- utilidades ----
    function nearestOpponentDistance(team: TeamRT, pos: Vector3D): number {
      let min = Infinity;
      for (const o of otherRT(team).players) {
        const d = vecDistance(o.position, pos);
        if (d < min) min = d;
      }
      return min;
    }

    function nearestOpponentTo(team: TeamRT, pos: Vector3D): { rt: TeamRT; idx: number } {
      const opp = otherRT(team);
      let best = 0;
      let min = Infinity;
      opp.players.forEach((p, i) => {
        const d = vecDistance(p.position, pos);
        if (d < min) {
          min = d;
          best = i;
        }
      });
      return { rt: opp, idx: best };
    }

    function nearestTeeammateIndex(team: TeamRT, pos: Vector3D, excludeGk: boolean): number {
      let best = -1;
      let min = Infinity;
      team.players.forEach((p, i) => {
        if (excludeGk && i === team.gkIdx) return;
        const d = vecDistance(p.position, pos);
        if (d < min) {
          min = d;
          best = i;
        }
      });
      return best;
    }

    function kickoff(kickoffTeam: 1 | 2): void {
      events.push({ t: time, type: "kickoff", team: kickoffTeam });
      for (const rt of [homeRT, awayRT]) {
        rt.team.slots.forEach((slot, i) => {
          const p = rt.players[i];
          const bx = rt.teamId === 1 ? slot.x : 100 - slot.x;
          p.position = vec3(bx, slot.y, 0);
          p.velocity = vec3(0, 0, 0);
          p.hasBall = false;
          p.stamina = Math.min(100, p.stamina + 1);
        });
        const gkCtx: GoalkeeperContext = {
          goalkeeper: rt.players[rt.gkIdx],
          ball,
          teammates: rt.players,
          opponents: otherRT(rt).players,
          field,
        };
        rt.gkTarget = e.gk.calculateOptimalPosition(gkCtx);
      }
      ball.position = vec3(50, 32.5, 0);
      ball.velocity = vec3(0, 0, 0);
      ball.possessionPlayer = -1;

      // Portador: meio-campista central preferencialmente
      const rt = rtOf(kickoffTeam);
      const order: PlayerRole[] = [
        PlayerRole.MidfielderCenter,
        PlayerRole.MidfielderAttacking,
        PlayerRole.Striker,
        PlayerRole.MidfielderDefensive,
        PlayerRole.WingerLeft,
        PlayerRole.WingerRight,
      ];
      let idx = -1;
      for (const role of order) {
        idx = rt.players.findIndex((p) => p.role === role);
        if (idx >= 0) break;
      }
      if (idx < 0) idx = rt.players.findIndex((p) => p.role !== PlayerRole.Goalkeeper);
      setCarrier(rt, idx);
      rt.players[idx].position = vec3(50, 32.5, 0);
      decisionCooldown = 1.5;
    }

    function countAction(rt: TeamRT, key: string): void {
      rt.stats.actionCounts[key] = (rt.stats.actionCounts[key] ?? 0) + 1;
    }

    function distToSegment(p: Vector3D, a: Vector3D, b: Vector3D): number {
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const len2 = abx * abx + aby * aby || 1;
      let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
    }

    function recordMemory(playerId: number, type: GameEventType, success: boolean, importance: number): void {
      const ev: MemoryEvent = {
        type,
        timestamp: time,
        position: vec3(ball.position.x, ball.position.y, 0),
        success,
        importance,
        context: "tournament",
      };
      e.memory.recordShortTermEvent(playerId, ev);
    }

    function recordRivalry(a: number, b: number, type: GameEventType, success: boolean): void {
      const ev: RivalryGameEvent = { type, playerId: a, targetPlayerId: b, success };
      e.rivalry.recordEncounter(a, b, ev, time);
    }

    // ---- Ações ----
    function resolvePass(behavior: BehaviorCommand): void {
      const rt = carrierRT!;
      const passer = carrierPlayer()!;
      const st = rt.stats;
      st.passesAttempted++;
      countAction(rt, "pass");

      // Rececionador: alvo do comportamento ou mais próximo do alvo
      let receiverIdx = -1;
      if (behavior.targetPlayerId !== undefined) {
        receiverIdx = rt.players.findIndex((p) => p.id === behavior.targetPlayerId);
      }
      if (receiverIdx < 0) {
        let min = Infinity;
        rt.players.forEach((p, i) => {
          if (i === carrierIdx) return;
          const d = vecDistance(p.position, behavior.targetPosition);
          if (d < min) {
            min = d;
            receiverIdx = i;
          }
        });
      }
      if (receiverIdx < 0) receiverIdx = nearestTeeammateIndex(rt, passer.position, false);

      const receiver = rt.players[receiverIdx];
      const dist = vecDistance(passer.position, receiver.position);
      const pressure = Math.max(0, Math.min(1, 1 - nearestOpponentDistance(rt, passer.position) / 15));
      const p = e.behavior.evaluatePass(passer, dist, pressure);

      if (Math.random() < p) {
        st.passesCompleted++;
        recordMemory(passer.id, GameEventType.PassComplete, true, 0.5);
        startFlight(receiver.position, passSpeed(dist), 3);
        setCarrier(rt, receiverIdx);
      } else {
        const intl = nearestOpponentTo(rt, receiver.position);
        intl.rt.stats.interceptions++;
        recordMemory(passer.id, GameEventType.PassIncomplete, false, 0.7);
        startFlight(intl.rt.players[intl.idx].position, passSpeed(dist), 3);
        setCarrier(intl.rt, intl.idx);
      }
    }

    function resolveShot(): "goal" | "save" | "miss" | "blocked" {
      const rt = carrierRT!;
      const other = otherRT(rt);
      const shooter = carrierPlayer()!;
      const st = rt.stats;
      st.shots++;
      countAction(rt, "shoot");
      const shotEv: MatchEvent = { t: time, type: "shot", team: rt.teamId };
      events.push(shotEv);

      const gx = goalXOf(rt.teamId);

      // Bloqueio: defensores na linha de remate
      let blockerIdx = -1;
      let blockerDist = Infinity;
      let blockers = 0;
      const goalPt = vec3(gx, 32.5, 0);
      other.players.forEach((d, i) => {
        if (i === other.gkIdx) return;
        const dd = distToSegment(d.position, shooter.position, goalPt);
        if (dd < 2.5) {
          blockers++;
          if (dd < blockerDist) {
            blockerDist = dd;
            blockerIdx = i;
          }
        }
      });
      if (blockers > 0) {
        const blockP = Math.min(0.55, 0.25 + 0.15 * (blockers - 1));
        if (Math.random() < blockP) {
          st.shotsBlocked++;
          recordMemory(shooter.id, GameEventType.ShotOffTarget, false, 0.6);
          shotEv.outcome = "blocked";
          startFlight(other.players[blockerIdx].position, 20, 2.5, 1);
          setCarrier(other, blockerIdx);
          return "blocked";
        }
      }

      const dist = vecDistance(shooter.position, goalPt);
      const pressure = Math.max(0, Math.min(1, 1 - nearestOpponentDistance(rt, shooter.position) / 8));
      const pShot = e.behavior.evaluateShot(shooter, dist, pressure);

      if (Math.random() >= pShot) {
        // Fora de baliza → posse do GR adversário (baliza parada)
        recordMemory(shooter.id, GameEventType.ShotOffTarget, false, 0.7);
        shotEv.outcome = "miss";
        if (physics) {
          // Voo para além da baliza (para fora, entre a trave e a linha lateral da área)
          const behindY = 32.5 + (Math.random() < 0.5 ? -1 : 1) * (4.5 + Math.random() * 5);
          startFlight(vec3(gx + (gx > 50 ? 6 : -6), behindY, 0), 30, 2.5);
        }
        setCarrier(other, other.gkIdx);
        return "miss";
      }

      // Remate à baliza: bola mira dentro da boca de gol
      st.shotsOnTarget++;
      const interceptY = 32.5 + (Math.random() - 0.5) * 7;
      const dx = gx - ball.position.x;
      const dy = interceptY - ball.position.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = 22 + Math.random() * 18;
      ball.velocity = vec3((dx / len) * speed, (dy / len) * speed, 0);

      const gk = other.players[other.gkIdx];
      const gkCtx: GoalkeeperContext = {
        goalkeeper: gk,
        ball,
        teammates: other.players,
        opponents: rt.players,
        field,
      };
      const shot = e.gk.predictShot(gkCtx);
      const saveP = shot ? e.gk.evaluateSave(gkCtx, shot) : 0.6;

      if (Math.random() < saveP) {
        other.stats.saves++;
        e.emotion.processEvent(gk, {
          type: GameEventType.Saving,
          playerId: gk.id,
          success: true,
          importance: 0.8,
        });
        recordMemory(shooter.id, GameEventType.ShotOnTarget, false, 0.6);
        shotEv.outcome = "save";
        events.push({ t: time, type: "save", team: other.teamId, player: gk.name });
        if (physics) {
          startFlight(gk.position, speed, 2, 1.2);
        } else {
          ball.velocity = vec3(0, 0, 0);
        }
        setCarrier(other, other.gkIdx);
        return "save";
      } else {
        // GOLAÇO
        st.goals++;
        score[rt.teamId]++;
        const minute = Math.floor(time / 60);
        goalLog.push(`${minute}' ${rt.team.profile.name} - ${shooter.name}`);
        shotEv.outcome = "goal";
        events.push({
          t: time,
          type: "goal",
          team: rt.teamId,
          player: shooter.name,
          scoreHome: score[1],
          scoreAway: score[2],
        });
        e.emotion.processEvent(shooter, {
          type: GameEventType.Goal,
          playerId: shooter.id,
          success: true,
          importance: 1,
        });
        e.emotion.processEvent(gk, {
          type: GameEventType.Goal,
          playerId: gk.id,
          success: false,
          importance: 1,
        });
        recordMemory(shooter.id, GameEventType.Goal, true, 1);
        if (physics) {
          // A bola continua à rede; o kickoff só acontece quando ela chega
          startFlight(vec3(gx + (gx > 50 ? 2 : -2), interceptY, 0), speed, 3, 1.5, other.teamId);
        } else {
          ball.velocity = vec3(0, 0, 0);
          kickoff(other.teamId);
        }
        return "goal";
      }
    }

    function resolveDribble(isSkill: boolean): void {
      const rt = carrierRT!;
      const carrier = carrierPlayer()!;
      const st = rt.stats;
      st.dribblesAttempted++;
      if (isSkill) st.skillMoves++;
      countAction(rt, isSkill ? "skill" : "dribble");

      const opp = nearestOpponentTo(rt, carrier.position);
      const defender = opp.rt.players[opp.idx];
      const p = e.behavior.evaluateDribble(carrier, defender);

      if (Math.random() < p) {
        st.dribblesWon++;
        recordRivalry(carrier.id, defender.id, GameEventType.DribbleWon, true);
        recordMemory(carrier.id, GameEventType.DribbleWon, true, 0.7);
        // mantém posse - o movimento leva-o em frente
        carrierTarget = vec3(goalXOf(rt.teamId), carrier.position.y * 0.6 + 32.5 * 0.4, 0);
      } else {
        recordRivalry(carrier.id, defender.id, GameEventType.DribbleLost, false);
        recordMemory(carrier.id, GameEventType.DribbleLost, false, 0.8);
        setCarrier(opp.rt, opp.idx);
      }
    }

    function resolveClear(): void {
      const rt = carrierRT!;
      rt.stats.passesAttempted++;
      countAction(rt, "clear");
      const opp = nearestOpponentTo(rt, carrierPlayer()!.position);
      startFlight(opp.rt.players[opp.idx].position, 30, 3);
      setCarrier(opp.rt, opp.idx);
      decisionCooldown = 3 + Math.random();
    }

    function resolveGkDistribution(): void {
      const rt = carrierRT!;
      const other = otherRT(rt);
      const gk = carrierPlayer()!;
      const st = rt.stats;
      st.onBallActions++;
      st.passesAttempted++;
      countAction(rt, "gk_pass");

      const gkCtx: GoalkeeperContext = {
        goalkeeper: gk,
        ball,
        teammates: rt.players,
        opponents: other.players,
        field,
      };
      const chosen = e.gk.chooseDistribution(gkCtx);

      // Filtro de segurança: não serve avançado bem marcado
      let target = chosen;
      if (chosen) {
        const lx = localX(rt.teamId, chosen.position.x);
        if (lx > 60 && nearestOpponentDistance(rt, chosen.position) < 6) {
          let bestScore = -Infinity;
          let bestIdx = -1;
          rt.players.forEach((mate, i) => {
            if (i === rt.gkIdx) return;
            const mlx = localX(rt.teamId, mate.position.x);
            if (mlx > 55) return;
            const scoreSafe =
              nearestOpponentDistance(rt, mate.position) - 0.15 * Math.abs(mlx - 40);
            if (scoreSafe > bestScore) {
              bestScore = scoreSafe;
              bestIdx = i;
            }
          });
          if (bestIdx >= 0) target = rt.players[bestIdx];
        }
      }

      if (target) {
        const laneClear = e.gk.isPassLaneClear(gk.position, target.position, other.players);
        if (laneClear || Math.random() < 0.75) {
          st.passesCompleted++;
          const idx = rt.players.indexOf(target);
          startFlight(target.position, passSpeed(vecDistance(gk.position, target.position)), 3.5);
          setCarrier(rt, idx);
          decisionCooldown = 3 + Math.random();
          return;
        }
      }
      // Balanço longo: 50/50
      if (Math.random() < 0.5) {
        const opp = nearestOpponentTo(rt, gk.position);
        startFlight(opp.rt.players[opp.idx].position, 30, 3.5);
        setCarrier(opp.rt, opp.idx);
      } else {
        const idx = nearestTeeammateIndex(rt, vec3(goalXOf(rt.teamId), 32.5, 0), true);
        if (idx >= 0 && idx !== carrierIdx) {
          st.passesCompleted++;
          startFlight(rt.players[idx].position, 28, 3.5);
          setCarrier(rt, idx);
        } else {
          const opp = nearestOpponentTo(rt, gk.position);
          startFlight(opp.rt.players[opp.idx].position, 30, 3.5);
          setCarrier(opp.rt, opp.idx);
        }
      }
      decisionCooldown = 3.5 + Math.random();
    }

    function performDecision(): void {
      const rt = carrierRT!;
      const player = carrierPlayer()!;
      const other = otherRT(rt);
      const st = rt.stats;
      st.onBallActions++;

      // O GR com a bola distribui
      if (carrierIdx === rt.gkIdx) {
        resolveGkDistribution();
        return;
      }

      const lx = localX(rt.teamId, player.position.x);
      const minutesRemaining = Math.max(0, minutes - time / 60);
      const gameCtx: DecisionGameContext = {
        hasPossession: true,
        isInOpponentHalf: lx > 50,
        isInOwnHalf: lx <= 50,
        isWinning: score[rt.teamId] > score[other.teamId],
        isLosing: score[rt.teamId] < score[other.teamId],
        goalDifference: score[rt.teamId] - score[other.teamId],
        minutesRemaining,
      };

      const decision = e.decision.makeDecision(
        player,
        ball,
        rt.players,
        other.players,
        gameCtx
      );

      // Criatividade: extremos/vanguarda de baixa disciplina tentam mais
      const gx = goalXOf(rt.teamId);
      const distToGoal = vecDistance(player.position, vec3(gx, 32.5, 0));
      let nearest = Infinity;
      let teammatesOpen = 0;
      let opponentsNearby = 0;
      for (const o of other.players) {
        const d = vecDistance(o.position, player.position);
        if (d < nearest) nearest = d;
        if (d < 12) opponentsNearby++;
      }
      for (const mate of rt.players) {
        if (mate.id === player.id) continue;
        if (nearestOpponentDistance(rt, mate.position) > 8) teammatesOpen++;
      }

      const isFwd = isForwardRole(player.role);
      const creativeRate =
        player.personality.discipline < 50 && isFwd ? 0.3 : 0.08;

      let behavior: BehaviorCommand | null = null;
      if (Math.random() < creativeRate) {
        const cCtx: CreativeContext = {
          distanceToGoal: distToGoal,
          distanceToNearestOpponent: nearest,
          hasSpace: nearest > 6,
          isUnderPressure: nearest < 4,
          teammatesOpen,
          opponentsNearby,
          isInFinalThird: lx > 66,
          isCounterAttack: time - lastTurnover < 6,
        };
        const opts: CreativeOption[] = e.creative.generateCreativeOptions(
          player,
          ball,
          cCtx
        );
        if (opts.length > 0) {
          const opt = e.creative.selectCreativeAction(player, opts);
          if (opt) {
            const persCtx: PersonalityGameContext = {
              isWinning: gameCtx.isWinning,
              isLosing: gameCtx.isLosing,
              goalDifference: gameCtx.goalDifference,
              minutesRemaining,
            };
            behavior = e.behavior.executeCreative(opt, player, persCtx);
          }
        }
      }
      if (!behavior) {
        behavior = e.behavior.executeDecision(decision, player, ball);
      }

      switch (behavior.type) {
        case "pass":
          resolvePass(behavior);
          decisionCooldown = 3 + Math.random() * 1.5;
          break;
        case "shoot":
        case "header": {
          // Realismo: remate só de perto (≤25m) e com espaço para arrematar;
          // de longe carrega a bola; pressionado de perto segura-a
          const shotDist = vecDistance(
            player.position,
            vec3(goalXOf(rt.teamId), 32.5, 0)
          );
          const nearestDef = nearestOpponentDistance(rt, player.position);
          if (shotDist <= 25 && nearestDef >= 2.0) {
            const outcome = resolveShot();
            // Golo: kickoff já definiu o cooldown (1.5s)
            if (outcome !== "goal") decisionCooldown = 4.5 + Math.random() * 1.5;
          } else if (shotDist <= 25) {
            countAction(rt, "hold");
            carrierTarget = vec3(player.position.x, player.position.y, 0);
            decisionCooldown = 2 + Math.random();
          } else {
            countAction(rt, "carry");
            carrierTarget = vec3(
              goalXOf(rt.teamId),
              player.position.y * 0.6 + 32.5 * 0.4,
              0
            );
            decisionCooldown = 2.5 + Math.random() * 1.5;
          }
          break;
        }
        case "dribble":
        case "skill_move":
          resolveDribble(behavior.type === "skill_move");
          decisionCooldown = 2.5 + Math.random() * 1.5;
          break;
        case "clear":
          resolveClear();
          break;
        case "move":
        case "sprint":
          countAction(rt, "move");
          carrierTarget = behavior.targetPosition;
          decisionCooldown = 2 + Math.random();
          break;
        default:
          // Sem ação explícita: segura a bola (não avança sozinho)
          countAction(rt, "hold");
          carrierTarget = vec3(player.position.x, player.position.y, 0);
          decisionCooldown = 2.5 + Math.random() * 1.5;
          break;
      }
    }

    function attemptTackle(): void {
      const rt = carrierRT!;
      const other = otherRT(rt);
      const carrier = carrierPlayer()!;
      let tacklerIdx = -1;
      for (let i = 0; i < other.players.length; i++) {
        if (i === other.gkIdx) continue;
        if (vecDistance(other.players[i].position, carrier.position) < 2.2) {
          tacklerIdx = i;
          break;
        }
      }
      if (tacklerIdx < 0) return;

      const tackler = other.players[tacklerIdx];
      const p = e.behavior.evaluateTackle(tackler, carrier);

      if (Math.random() < p) {
        other.stats.tacklesWon++;
        recordRivalry(tackler.id, carrier.id, GameEventType.TackleWon, true);
        lastTurnover = time;
        setCarrier(other, tacklerIdx);
      } else {
        // Desarme falhado = drible vencido (conta como drible também)
        rt.stats.dribblesAttempted++;
        rt.stats.dribblesWon++;
        recordRivalry(carrier.id, tackler.id, GameEventType.DribbleWon, true);
      }
    }

    // ---- Movimento ----
    function movePlayer(p: PlayerState, target: Vector3D, speedMul: number, step: number): void {
      const dx = target.x - p.position.x;
      const dy = target.y - p.position.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.05) return;
      const speed =
        (5 + (p.physical.pace / 100) * 4) *
        (0.6 + (p.stamina / 100) * 0.4) *
        speedMul;
      const stepLen = Math.min(speed * step, d);
      p.position.x = Math.max(1, Math.min(99, p.position.x + (dx / d) * stepLen));
      p.position.y = Math.max(1, Math.min(64, p.position.y + (dy / d) * stepLen));
    }

    let lastTurnover = 0;

    kickoff(possession);

    // ---- Loop principal ----
    let halfEmitted = false;

    while (time < totalSeconds) {
      time += dt;
      ticks++;

      // Eventos de período
      if (!halfEmitted && time >= totalSeconds / 2) {
        halfEmitted = true;
        events.push({ t: time, type: "halftime" });
      }
      if (time + dt > totalSeconds) {
        events.push({ t: time, type: "fulltime", scoreHome: score[1], scoreAway: score[2] });
      }

      // Bola: voa (com física) ou segue o portador
      const carrier = carrierPlayer();
      const f = getFlight();
      if (physics && f) {
        const done = physics.step(ball, dt, f.homing);
        f.timeout -= dt;
        if (done || f.timeout <= 0) {
          physics.attach(ball, carrier ? carrier.position : ball.position);
          const pk = f.pendingKickoff;
          flight = null;
          if (pk) kickoff(pk);
        }
      } else if (carrier) {
        ball.position = vec3(carrier.position.x, carrier.position.y, 0);
        ball.possessionPlayer = carrier.id;
        ball.possessionTeam = possession;
      }

      // Posse
      const posStats = rtOf(possession).stats;
      posStats.possessionTicks++;

      // Decaimento emocional
      for (const rt of [homeRT, awayRT]) {
        for (const p of rt.players) e.emotion.decayEmotions(p.id, dt);
      }

      // Fases táticas
      homeRT.tactical.setPhase(possession === 1 ? "possession" : "defending");
      awayRT.tactical.setPhase(possession === 2 ? "possession" : "defending");

      // Movimento equipa 1
      const pressers1 = computingPressers(homeRT);
      homeRT.players.forEach((p, i) => {
        if (i === homeRT.gkIdx) {
          movePlayer(p, homeRT.gkTarget, 0.9, dt);
        } else if (carrierRT === homeRT && i === carrierIdx) {
          const target = carrierTarget ?? vec3(100, p.position.y * 0.6 + 32.5 * 0.4, 0);
          movePlayer(p, target, 1.1, dt);
        } else if (possession === 2 && pressers1.includes(i)) {
          const c = carrierPlayer();
          if (c) {
            const chase = physics && getFlight() ? ball.position : c.position;
            const target =
              vecDistance(p.position, chase) < 1.5
                ? chase
                : presserTarget(homeRT, chase);
            movePlayer(p, target, 1.15, dt);
          }
        } else {
          movePlayer(p, tacticalTarget(homeRT, i), 1.0, dt);
        }
        // Resistência
        p.stamina = Math.max(
          55,
          Math.min(100, p.stamina + (carrierRT?.players[carrierIdx] === p ? -0.03 : 0.02) * dt)
        );
      });

      // Movimento equipa 2 (com scratch espelhado)
      fillScratch();
      const pressers2 = computingPressers(awayRT);
      awayRT.players.forEach((p, i) => {
        if (i === awayRT.gkIdx) {
          movePlayer(p, awayRT.gkTarget, 0.9, dt);
        } else if (carrierRT === awayRT && i === carrierIdx) {
          const target = carrierTarget ?? vec3(0, p.position.y * 0.6 + 32.5 * 0.4, 0);
          movePlayer(p, target, 1.1, dt);
        } else if (possession === 1 && pressers2.includes(i)) {
          const c = carrierPlayer();
          if (c) {
            const chase = physics && getFlight() ? ball.position : c.position;
            const target =
              vecDistance(p.position, chase) < 1.5
                ? chase
                : presserTarget(awayRT, chase);
            movePlayer(p, target, 1.15, dt);
          }
        } else {
          movePlayer(p, tacticalTarget(awayRT, i), 1.0, dt);
        }
        p.stamina = Math.max(
          55,
          Math.min(100, p.stamina + (carrierRT?.players[carrierIdx] === p ? -0.03 : 0.02) * dt)
        );
      });

      // Separação de jogadores (colisão suave) — só com física
      if (physics) {
        physics.separate(homeRT.players.concat(awayRT.players));
      }

      // Desarmes: adversários colados ao portador tentam (não durante o voo da bola)
      if (carrierRT && !flight && Math.random() < 0.3 * dt) {
        attemptTackle();
      }

      // GK decide posição a cada 2s
      gkDecideCooldown -= dt;
      if (gkDecideCooldown <= 0) {
        gkDecideCooldown = 2;
        for (const rt of [homeRT, awayRT]) {
          const ctx = gkContext(rt);
          const decision = e.gk.decide(ctx);
          const cmd = e.behavior.executeGoalkeeper(decision);
          rt.gkTarget = cmd.targetPosition;
        }
      }

      // Desvio de formação a cada 4s
      devCooldown -= dt;
      if (devCooldown <= 0) {
        devCooldown = 4;
        for (const rt of [homeRT, awayRT]) {
          rt.team.slots.forEach((slot, i) => {
            if (i === rt.gkIdx) return;
            if (carrierRT === rt && i === carrierIdx) return;
            const p = rt.players[i];
            const bx = rt.teamId === 1 ? slot.x : 100 - slot.x;
            const d = Math.hypot(p.position.x - bx, p.position.y - slot.y);
            rt.stats.formationDeviationSum += d;
            rt.stats.formationDeviationSamples++;
          });
        }
      }

      // Decisão do portador (não decide com a bola no ar — espera pela receção)
      decisionCooldown -= dt;
      if (carrierRT && !flight && decisionCooldown <= 0) {
        performDecision();
      }

      // Estado para o host (refs vivas — consumir já)
      yield {
        time,
        ticks,
        scoreHome: score[1],
        scoreAway: score[2],
        possession,
        ball,
        home: homeRT.players,
        away: awayRT.players,
        homeStats: homeRT.stats,
        awayStats: awayRT.stats,
        events: events.splice(0),
        ballInFlight: getFlight() !== null,
      };
    }

    /** Alvo do marking: cortar a linha de remate (3m à frente do portador) */
    function presserTarget(defTeam: TeamRT, carrierPos: Vector3D): Vector3D {
      const defendedGoalX = defTeam.teamId === 1 ? 0 : 100;
      const dir = Math.sign(defendedGoalX - carrierPos.x) || 1;
      return vec3(
        Math.max(1, Math.min(99, carrierPos.x + dir * 3)),
        carrierPos.y,
        0
      );
    }

    /** Índices dos jogadores que fazem pressing */
    function computingPressers(rt: TeamRT): number[] {
      if (carrierRT === rt) return [];
      const c = carrierPlayer();
      if (!c) return [];
      // Estilo pressing empurra mais; portador perto da NOSA baliza = apoios
      let count = rt.team.profile.style === "pressing" ? 2 : 1;
      const defendedGoalX = rt.teamId === 1 ? 0 : 100;
      const goalDist = Math.abs(c.position.x - defendedGoalX);
      if (goalDist < 30) count = Math.min(3, count + 1);
      if (goalDist < 18) count = Math.min(5, count + 2); // congestionão na área
      const scored: { i: number; d: number }[] = [];
      rt.players.forEach((p, i) => {
        if (i === rt.gkIdx) return;
        scored.push({ i, d: vecDistance(p.position, c.position) });
      });
      scored.sort((a, b) => a.d - b.d);
      return scored.slice(0, count).map((s) => s.i);
    }

    return {
      homeId: home.profile.id,
      awayId: away.profile.id,
      homeShort: home.profile.short,
      awayShort: away.profile.short,
      homeGoals: score[1],
      awayGoals: score[2],
      home: homeRT.stats,
      away: awayRT.stats,
      goalLog,
      ticks,
      wallMs: performance.now() - wallStart,
    };
  }
}
