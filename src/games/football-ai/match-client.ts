/**
 * MatchClient — ponte do client com o Web Worker do servidor.
 * Toda a lógica (engines, sim, física) vive no worker; aqui só se
 * publica comandos e se consomem mensagens (protocol.ts).
 */
import type {
  Command,
  GameEvent,
  InitCommand,
  MatchStats,
  MatchSummary,
  MsgIn,
  MsgOut,
  Snapshot,
  TeamInfo,
} from "../../shared/protocol";

export interface MatchClientHandlers {
  onReady(teams: TeamInfo[]): void;
  onTeams(teams: TeamInfo[]): void;
  onSnapshot(snap: Snapshot): void;
  onStats(stats: MatchStats): void;
  onEvents(events: GameEvent[]): void;
  onDone(summary: MatchSummary): void;
  onError(message: string): void;
}

export class MatchClient {
  private worker: Worker;
  private handlers: MatchClientHandlers;
  private disposed = false;

  constructor(handlers: MatchClientHandlers) {
    this.handlers = handlers;
    // Vite resolve este URL no build → worker empacotado, zero rede.
    this.worker = new Worker(new URL("../../server/host/worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (ev: MessageEvent<MsgOut>) => this.receive(ev.data);
    this.worker.onerror = (ev) => {
      this.handlers.onError(ev.message || "worker falhou");
    };
  }

  listTeams(): void {
    this.send({ type: "listTeams" });
  }

  init(opts: Omit<InitCommand, "type">): void {
    this.send({ type: "init", ...opts });
  }

  pause(): void {
    this.send({ type: "pause" });
  }

  resume(): void {
    this.send({ type: "resume" });
  }

  speed(timeScale: number): void {
    this.send({ type: "speed", timeScale });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.terminate();
  }

  private send(cmd: Command): void {
    if (this.disposed) return;
    const msg: MsgIn = { kind: "command", cmd };
    this.worker.postMessage(msg);
  }

  private receive(data: MsgOut): void {
    if (!data || typeof data !== "object") return;
    switch (data.kind) {
      case "ready":
        this.handlers.onReady(data.teams);
        break;
      case "teams":
        this.handlers.onTeams(data.teams);
        break;
      case "snapshot":
        this.handlers.onSnapshot(data.snap);
        break;
      case "stats":
        this.handlers.onStats(data.stats);
        break;
      case "events":
        this.handlers.onEvents(data.events);
        break;
      case "done":
        this.handlers.onDone(data.summary);
        break;
      case "error":
        this.handlers.onError(data.message);
        break;
      case "pong":
        break;
    }
  }
}
