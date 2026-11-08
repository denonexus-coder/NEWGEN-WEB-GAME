/**
 * Hud — overlay DOM do jogo (placar, relógio, velocidade, stats, banners).
 * Estilos inline (auto-contido — não depende do scan do Tailwind).
 * O overlay fica DENTRO do container do canvas, com z-index abaixo do
 * menu de pausa do launcher (z-10) para não competir com ele.
 */
import type { GameEvent, MatchStats, MatchSummary, TeamInfo } from "../../shared/protocol";

const SPEEDS: { label: string; value: number }[] = [
  { label: "1×", value: 1 },
  { label: "4×", value: 4 },
  { label: "16×", value: 16 },
  { label: "MAX", value: 1000 },
];

function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration>,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

export interface HudHandlers {
  onSpeed(value: number): void;
  onNewMatch(): void;
}

export class Hud {
  readonly root: HTMLElement;
  private homeName!: HTMLElement;
  private awayName!: HTMLElement;
  private homeScore!: HTMLElement;
  private awayScore!: HTMLElement;
  private clockEl!: HTMLElement;
  private statsPanel!: HTMLElement;
  private statsBody!: HTMLElement;
  private banner!: HTMLElement;
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  private fulltime!: HTMLElement;
  private speedButtons: HTMLButtonElement[] = [];
  private currentSpeed = 16;
  private handlers: HudHandlers;

  constructor(parent: HTMLElement, handlers: HudHandlers) {
    this.handlers = handlers;
    this.root = el("div", {
      position: "absolute",
      inset: "0",
      zIndex: "5",
      pointerEvents: "none",
      fontFamily: "system-ui, sans-serif",
      userSelect: "none",
      overflow: "hidden",
    });

    // ---------- placar ----------
    const score = el("div", {
      position: "absolute",
      top: "calc(env(safe-area-inset-top, 0px) + 10px)",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      background: "rgba(4,10,20,0.82)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "14px",
      padding: "6px 14px",
      color: "#fff",
      backdropFilter: "blur(6px)",
      pointerEvents: "auto",
    });

    this.homeName = el("span", { fontSize: "13px", fontWeight: "700", letterSpacing: "0.4px" }, "—");
    this.homeScore = el("span", { fontSize: "22px", fontWeight: "800", minWidth: "18px", textAlign: "center" }, "0");
    this.clockEl = el(
      "span",
      {
        fontSize: "15px",
        fontWeight: "700",
        fontVariantNumeric: "tabular-nums",
        color: "#7dd3fc",
        padding: "0 8px",
        borderLeft: "1px solid rgba(255,255,255,0.15)",
        borderRight: "1px solid rgba(255,255,255,0.15)",
      },
      "00:00"
    );
    this.awayScore = el("span", { fontSize: "22px", fontWeight: "800", minWidth: "18px", textAlign: "center" }, "0");
    this.awayName = el("span", { fontSize: "13px", fontWeight: "700", letterSpacing: "0.4px" }, "—");
    score.append(this.homeName, this.homeScore, this.clockEl, this.awayScore, this.awayName);

    // ---------- velocidade + stats (canto inferior) ----------
    const controls = el("div", {
      position: "absolute",
      right: "calc(env(safe-area-inset-right, 0px) + 12px)",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      alignItems: "flex-end",
      pointerEvents: "auto",
    });

    const speedRow = el("div", { display: "flex", gap: "6px" });
    for (const sp of SPEEDS) {
      const btn = document.createElement("button");
      btn.textContent = sp.label;
      Object.assign(btn.style, {
        padding: "7px 12px",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.18)",
        background: sp.value === this.currentSpeed ? "#22d3ee" : "rgba(4,10,20,0.8)",
        color: sp.value === this.currentSpeed ? "#04222b" : "#e2e8f0",
        fontWeight: "800",
        fontSize: "13px",
        cursor: "pointer",
        font: "inherit",
      } as Partial<CSSStyleDeclaration>);
      btn.onclick = () => {
        this.setSpeed(sp.value);
        this.handlers.onSpeed(sp.value);
      };
      this.speedButtons.push(btn);
      speedRow.append(btn);
    }

    const statsBtn = document.createElement("button");
    statsBtn.textContent = "Estatísticas";
    Object.assign(statsBtn.style, {
      padding: "7px 14px",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(4,10,20,0.8)",
      color: "#e2e8f0",
      fontWeight: "700",
      fontSize: "13px",
      cursor: "pointer",
      font: "inherit",
    } as Partial<CSSStyleDeclaration>);
    statsBtn.onclick = () => this.toggleStats();
    controls.append(speedRow, statsBtn);

    // ---------- painel de estatísticas ----------
    this.statsPanel = el("div", {
      position: "absolute",
      right: "calc(env(safe-area-inset-right, 0px) + 12px)",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 74px)",
      width: "min(340px, 78vw)",
      background: "rgba(4,10,20,0.92)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: "14px",
      padding: "12px 14px",
      color: "#e2e8f0",
      fontSize: "13px",
      display: "none",
      pointerEvents: "auto",
    });
    this.statsBody = el("div", { display: "flex", flexDirection: "column", gap: "5px" });
    this.statsPanel.append(this.statsBody);

    // ---------- banner de eventos (golo/intervalo) ----------
    this.banner = el("div", {
      position: "absolute",
      top: "30%",
      left: "50%",
      transform: "translate(-50%,-50%) scale(0.9)",
      padding: "14px 30px",
      borderRadius: "18px",
      background: "rgba(4,10,20,0.9)",
      border: "2px solid #22d3ee",
      color: "#fff",
      fontSize: "clamp(20px, 5vw, 34px)",
      fontWeight: "900",
      textAlign: "center",
      opacity: "0",
      transition: "opacity 0.25s, transform 0.25s",
      pointerEvents: "none",
      textShadow: "0 2px 12px rgba(0,0,0,0.6)",
    });

    // ---------- fim de jogo ----------
    this.fulltime = el("div", {
      position: "absolute",
      inset: "0",
      background: "rgba(2,6,14,0.88)",
      display: "none",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "14px",
      color: "#fff",
      pointerEvents: "auto",
      zIndex: "6",
    });

    this.root.append(score, controls, this.statsPanel, this.banner, this.fulltime);
    parent.append(this.root);
  }

  setTeams(home: TeamInfo, away: TeamInfo): void {
    this.homeName.textContent = `${home.short} · ${home.name}`;
    this.awayName.textContent = `${away.name} · ${away.short}`;
    this.homeName.style.color = home.colors[0];
    this.awayName.style.color = away.colors[0];
  }

  setScore(home: number, away: number): void {
    this.homeScore.textContent = String(home);
    this.awayScore.textContent = String(away);
  }

  setTime(seconds: number): void {
    this.clockEl.textContent = fmtClock(seconds);
  }

  setSpeed(value: number): void {
    this.currentSpeed = value;
    this.speedButtons.forEach((btn, i) => {
      const on = SPEEDS[i].value === value;
      btn.style.background = on ? "#22d3ee" : "rgba(4,10,20,0.8)";
      btn.style.color = on ? "#04222b" : "#e2e8f0";
    });
  }

  setStats(stats: MatchStats): void {
    if (this.statsPanel.style.display === "none") return; // só calcula quando aberto
    const h = stats.home;
    const a = stats.away;
    const totalPos = h.possessionTicks + a.possessionTicks;
    const hp = totalPos ? Math.round((100 * h.possessionTicks) / totalPos) : 50;
    const rows: [string, string, string][] = [
      ["Posse", `${hp}%`, `${100 - hp}%`],
      ["Passes", `${h.passesCompleted}/${h.passesAttempted}`, `${a.passesCompleted}/${a.passesAttempted}`],
      ["Remates", `${h.shots}`, `${a.shots}`],
      ["À baliza", `${h.shotsOnTarget}`, `${a.shotsOnTarget}`],
      ["Defesas", `${h.saves}`, `${a.saves}`],
      ["Dribles", `${h.dribblesWon}`, `${a.dribblesWon}`],
      ["Desarmes", `${h.tacklesWon}`, `${a.tacklesWon}`],
      ["Interceptações", `${h.interceptions}`, `${a.interceptions}`],
    ];
    this.statsBody.replaceChildren();
    for (const [label, x, y] of rows) {
      const row = el("div", { display: "flex", justifyContent: "space-between", gap: "8px" });
      row.append(
        el("span", { color: "#7dd3fc", fontWeight: "700", minWidth: "40px", textAlign: "center" }, x),
        el("span", { color: "#94a3b8", fontSize: "12px" }, label),
        el("span", { color: "#fda4af", fontWeight: "700", minWidth: "40px", textAlign: "center" }, y)
      );
      this.statsBody.append(row);
    }
  }

  toggleStats(): void {
    const open = this.statsPanel.style.display === "none";
    this.statsPanel.style.display = open ? "block" : "none";
    this.root.dispatchEvent(new CustomEvent("statsopen", { detail: open }));
  }

  get statsOpen(): boolean {
    return this.statsPanel.style.display !== "none";
  }

  /** banner curto (golo, intervalo, fim) */
  showBanner(text: string, color = "#22d3ee", ms = 2600): void {
    this.banner.textContent = text;
    this.banner.style.borderColor = color;
    this.banner.style.opacity = "1";
    this.banner.style.transform = "translate(-50%,-50%) scale(1)";
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      this.banner.style.opacity = "0";
      this.banner.style.transform = "translate(-50%,-50%) scale(0.9)";
    }, ms);
  }

  handleEvent(ev: GameEvent): void {
    if (ev.type === "goal") {
      this.showBanner(`⚽ GOLAÇO!  ${ev.player ?? ""}  (${Math.floor(ev.t / 60)}')`, "#fbbf24", 3200);
    } else if (ev.type === "halftime") {
      this.showBanner("⏸ INTERVALO", "#94a3b8", 2200);
    } else if (ev.type === "fulltime") {
      this.showBanner("🏁 FIM DE JOGO", "#22d3ee", 2600);
    } else if (ev.type === "save") {
      this.showBanner(`DEFESA DO GR — ${ev.player ?? ""}`, "#38bdf8", 1600);
    }
  }

  showFulltime(summary: MatchSummary, homeName: string, awayName: string): void {
    this.fulltime.replaceChildren();
    const title = el("div", { fontSize: "clamp(24px,6vw,44px)", fontWeight: "900" }, "🏁 FIM DE JOGO");
    const score = el(
      "div",
      { fontSize: "clamp(36px,10vw,72px)", fontWeight: "900", display: "flex", gap: "18px", alignItems: "center" },
      ""
    );
    score.append(
      el("span", { color: "#7dd3fc" }, summary.homeGoals.toString()),
      el("span", { color: "#64748b", fontSize: "0.6em" }, "—"),
      el("span", { color: "#fda4af" }, summary.awayGoals.toString())
    );
    const names = el(
      "div",
      { display: "flex", gap: "18px", fontSize: "clamp(13px,3.4vw,18px)", fontWeight: "700", color: "#cbd5e1" },
      ""
    );
    names.append(el("span", {}, homeName), el("span", {}, awayName));

    const btn = document.createElement("button");
    btn.textContent = "NOVA PARTIDA";
    Object.assign(btn.style, {
      padding: "13px 34px",
      borderRadius: "14px",
      border: "none",
      background: "#22d3ee",
      color: "#04222b",
      fontWeight: "900",
      fontSize: "16px",
      cursor: "pointer",
      font: "inherit",
      marginTop: "8px",
    } as Partial<CSSStyleDeclaration>);
    btn.onclick = () => this.handlers.onNewMatch();

    this.fulltime.append(title, score, names, btn);
    this.fulltime.style.display = "flex";
  }

  hideFulltime(): void {
    this.fulltime.style.display = "none";
  }

  showError(message: string): void {
    this.showBanner(`⚠ ${message}`, "#ef4444", 5000);
  }

  dispose(): void {
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.root.remove();
  }
}
