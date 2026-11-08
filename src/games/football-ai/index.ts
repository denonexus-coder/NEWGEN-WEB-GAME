/**
 * Football AI — módulo do jogo no launcher.
 *
 * Arquitetura (estilo Minecraft): TODO o logic (12 engines, simulação,
 * física) corre no Web Worker (src/server/host/worker.ts); este client só
 * consome snapshots via protocol.ts, interpola e renderiza com three.js.
 *
 * Registro automático: o gameRegistry varre todos src/games/<id>/index.ts
 * (padrão de import dinâmico).
 */
import type { EngineContext, GameHandle, GameModule } from "../../engine/types";
import type { MatchSummary, TeamInfo } from "../../shared/protocol";
import { FootballView } from "./view";
import { Hud } from "./hud";
import { Menu, type MatchConfig } from "./menu";
import { MatchClient } from "./match-client";
import { Interpolator } from "./interpolator";

function mount(ctx: EngineContext): GameHandle {
  const container = ctx.canvas.parentElement ?? document.body;

  const view = new FootballView(ctx.settings.quality);
  ctx.render.setTarget(view.scene, view.camera);

  const interp = new Interpolator();
  let client: MatchClient | null = null;
  let teams: TeamInfo[] = [];
  let started = false;

  const hud = new Hud(container, {
    onSpeed: (v) => client?.speed(v),
    onNewMatch: () => {
      hud.hideFulltime();
      interp.reset();
      menu.show();
      started = false;
      client?.listTeams();
    },
  });

  const menu = new Menu(container, {
    onStart: (cfg: MatchConfig) => {
      if (!client) return;
      menu.hide();
      hud.hideFulltime();
      interp.reset();
      hud.setSpeed(cfg.timeScale);
      client.init({
        seed: cfg.seed,
        homeId: cfg.homeId,
        awayId: cfg.awayId,
        minutes: cfg.minutes,
        timeScale: cfg.timeScale,
        physics: cfg.physics,
      });
      started = true;
    },
  });

  client = new MatchClient({
    onReady: (t) => {
      teams = t;
      hud.setTeams(t[0], t[1]);
    },
    onTeams: (t) => {
      teams = t;
      menu.setTeams(t);
    },
    onSnapshot: (snap) => interp.push(snap),
    onStats: (stats) => hud.setStats(stats),
    onEvents: (events) => {
      for (const ev of events) hud.handleEvent(ev);
    },
    onDone: (summary: MatchSummary) => {
      const home = teams.find((t) => t.id === summary.homeId);
      const away = teams.find((t) => t.id === summary.awayId);
      hud.showFulltime(summary, home?.name ?? "Casa", away?.name ?? "Fora");
    },
    onError: (msg) => hud.showError(msg),
  });
  client.listTeams();

  // ------------------------------------------------------------- loop

  return {
    update(dt: number): void {
      const state = interp.sample();
      if (state) {
        view.apply(state);
        hud.setScore(state.scoreHome, state.scoreAway);
        hud.setTime(state.gameTime);
      }
      view.updateCamera(dt);
      // o painel de stats atualiza sozinho (o server envia ~1×/s)
    },

    resize(width: number, height: number): void {
      view.resize(width, height);
    },

    pause(): void {
      client?.pause();
    },

    resume(): void {
      if (started) client?.resume();
    },

    dispose(): void {
      client?.dispose();
      client = null;
      hud.dispose();
      menu.dispose();
      view.dispose();
      ctx.render.clearTarget();
    },
  };
}

const game: GameModule = {
  id: "football-ai",
  name: "Football AI",
  description:
    "Futebol com IA completa:12 engines (percepção, personalidade, emoção, decisão, criatividade, memória, aprendizagem, rivalidade, tática, pathfinding, GR e comportamento) + física de bola. Offline e determinístico.",
  version: "0.1.0",
  author: "NewGen",
  mount,
};

export default game;
