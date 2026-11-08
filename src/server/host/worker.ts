/**
 * Web Worker do servidor — Toda a lógica do jogo corre aqui
 * (12 engines + simulação + física), nunca no main thread.
 *
 * Protocolo: src/shared/protocol.ts (MsgIn / MsgOut).
 * Snapshots: Float32Array transferidos (zero cópia).
 *
 * Scheduler: setInterval(TICK_MS) → avança `timeScale` ticks por relógio.
 *   timeScale 1  = tempo real (20 TPS)
 *   timeScale 20 = 20× (partida em ~4.5s)
 *   timeScale 1000 = MAX (cap: 1000 ticks/run → ~5.4s p/ 90')
 */
import { GameServer, listTeamInfo } from "../server-core";
import {
  LOGIC_DT,
  PROTOCOL_VERSION,
  TICK_MS,
  type Command,
  type InitCommand,
  type MsgIn,
  type MsgOut,
} from "../../shared/protocol";

/** Contrato mínimo do global de worker (compatível com a lib DOM do tsconfig) */
interface WorkerCtx {
  postMessage(msg: MsgOut, transfer?: Transferable[]): void;
  addEventListener(type: "message", cb: (ev: MessageEvent<MsgIn>) => void): void;
}
const ctx = globalThis as unknown as WorkerCtx;

const MAX_TICKS_PER_RUN = 1000;

let server: GameServer | null = null;
let paused = false;
let timeScale = 1;
let timer: ReturnType<typeof setInterval> | null = null;

function post(msg: MsgOut, transfer?: Transferable[]): void {
  ctx.postMessage(msg, transfer);
}

function stopTimer(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function startTimer(): void {
  stopTimer();
  timer = setInterval(() => {
    if (!server || paused) return;
    const ticks = Math.max(1, Math.min(MAX_TICKS_PER_RUN, Math.round(timeScale)));
    let r;
    try {
      r = server.step(ticks);
    } catch (err) {
      post({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      stopTimer();
      server.dispose();
      server = null;
      return;
    }
    if (r.snapshot) {
      // buffers novos por snapshot → transferíveis
      post({ kind: "snapshot", snap: r.snapshot }, [
        r.snapshot.players.buffer as ArrayBuffer,
        r.snapshot.ball.buffer as ArrayBuffer,
      ]);
    }
    if (r.events.length > 0) post({ kind: "events", events: r.events });
    if (r.stats) post({ kind: "stats", stats: r.stats });
    if (r.done) {
      const summary = server.getSummary();
      if (summary) post({ kind: "done", summary });
      stopTimer();
      server.dispose();
      server = null;
    }
  }, TICK_MS);
}

function handleCommand(cmd: Command): void {
  switch (cmd.type) {
    case "init": {
      initServer(cmd);
      break;
    }
    case "listTeams": {
      post({ kind: "teams", teams: listTeamInfo() });
      break;
    }
    case "pause":
      paused = true;
      break;
    case "resume":
      paused = false;
      break;
    case "speed":
      timeScale = Math.max(1, Math.min(1000, cmd.timeScale));
      break;
    case "tactic":
    case "substitute":
      // M2: comandos de bancada — por agora só são aceites (ack implícito)
      break;
  }
}

function initServer(cmd: InitCommand): void {
  if (server) {
    stopTimer();
    server.dispose();
    server = null;
  }
  timeScale = Math.max(1, Math.min(1000, cmd.timeScale));
  paused = false;
  try {
    server = new GameServer({
      seed: cmd.seed,
      homeId: cmd.homeId,
      awayId: cmd.awayId,
      minutes: cmd.minutes,
      dt: LOGIC_DT,
      physics: cmd.physics,
    });
    server.start();
    post({ kind: "ready", protocol: PROTOCOL_VERSION, teams: server.getTeams() });
    startTimer();
  } catch (err) {
    post({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    server = null;
  }
}

ctx.addEventListener("message", (ev) => {
  const data = ev.data;
  if (!data || typeof data !== "object") return;
  if (data.kind === "command") {
    try {
      handleCommand(data.cmd);
    } catch (err) {
      post({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  } else if (data.kind === "ping") {
    post({ kind: "pong", t: data.t });
  }
});
