/**
 * Menu — ecrã pré-partida: escolha das duas equipas, seed e botão JOGAR.
 * Os dados vêm do servidor (listTeams) — nada duplicado no client.
 */
import type { TeamInfo } from "../../shared/protocol";

export interface MatchConfig {
  homeId: number;
  awayId: number;
  seed: number;
  timeScale: number;
  minutes: number;
  physics: boolean;
}

export interface MenuHandlers {
  onStart(cfg: MatchConfig): void;
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

export class Menu {
  readonly root: HTMLElement;
  private teams: TeamInfo[] = [];
  private homeIdx = 0;
  private awayIdx = 1;
  private homeCard!: HTMLElement;
  private awayCard!: HTMLElement;
  private seedLabel!: HTMLElement;
  private seed = Math.floor(Math.random() * 1e9);
  private speedIdx = 2; //16× por omissão
  private speedBtns: HTMLButtonElement[] = [];
  private handlers: MenuHandlers;
  private ready = false;

  private static readonly SPEEDS: { label: string; value: number }[] = [
    { label: "1×", value: 1 },
    { label: "4×", value: 4 },
    { label: "16×", value: 16 },
    { label: "MAX", value: 1000 },
  ];

  constructor(parent: HTMLElement, handlers: MenuHandlers) {
    this.handlers = handlers;
    this.root = el("div", {
      position: "absolute",
      inset: "0",
      zIndex: "7",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "16px",
      background: "radial-gradient(ellipse at center, rgba(8,16,32,0.92) 0%, rgba(2,6,14,0.97) 100%)",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
      padding: "16px",
      overflowY: "auto",
    } as Partial<CSSStyleDeclaration>);

    this.root.append(
      el("div", { fontSize: "clamp(26px,7vw,46px)", fontWeight: "900", letterSpacing: "1px" }, "⚽ FOOTBALL AI"),
      el(
        "div",
        { fontSize: "13px", color: "#7dd3fc", fontWeight: "600", textAlign: "center" },
        "12 engines de IA · física real · offline · determinístico"
      )
    );

    // linha das duas equipas
    const row = el("div", {
      display: "flex",
      gap: "14px",
      alignItems: "stretch",
      justifyContent: "center",
      flexWrap: "wrap",
      maxWidth: "760px",
      width: "100%",
    } as Partial<CSSStyleDeclaration>);
    this.homeCard = this.buildPicker("CASA", (d) => this.pick(0, d));
    this.awayCard = this.buildPicker("FORA", (d) => this.pick(1, d));
    row.append(this.homeCard, el("div", { fontSize: "28px", fontWeight: "900", alignSelf: "center" }, "VS"), this.awayCard);

    // seed + velocidade
    const opts = el("div", { display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" } as Partial<CSSStyleDeclaration>);

    const seedBox = el("div", {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: "12px",
      padding: "8px 12px",
      fontSize: "13px",
    } as Partial<CSSStyleDeclaration>);
    this.seedLabel = el("span", { fontVariantNumeric: "tabular-nums", color: "#fbbf24", fontWeight: "700" }, String(this.seed));
    const dice = document.createElement("button");
    dice.textContent = "🎲";
    Object.assign(dice.style, {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: "16px",
      padding: "0",
    } as Partial<CSSStyleDeclaration>);
    dice.onclick = () => {
      this.seed = Math.floor(Math.random() * 1e9);
      this.seedLabel.textContent = String(this.seed);
    };
    seedBox.append(el("span", { color: "#94a3b8" }, "Seed"), this.seedLabel, dice);

    const speedBox = el("div", {
      display: "flex",
      gap: "6px",
      alignItems: "center",
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: "12px",
      padding: "8px 10px",
    } as Partial<CSSStyleDeclaration>);
    speedBox.append(el("span", { color: "#94a3b8", fontSize: "13px" }, "Velocidade"));
    Menu.SPEEDS.forEach((sp, i) => {
      const b = document.createElement("button");
      b.textContent = sp.label;
      Object.assign(b.style, {
        padding: "6px 11px",
        borderRadius: "9px",
        border: "1px solid rgba(255,255,255,0.16)",
        background: i === this.speedIdx ? "#22d3ee" : "rgba(0,0,0,0.35)",
        color: i === this.speedIdx ? "#04222b" : "#e2e8f0",
        fontWeight: "800",
        fontSize: "13px",
        cursor: "pointer",
        font: "inherit",
      } as Partial<CSSStyleDeclaration>);
      b.onclick = () => {
        this.speedIdx = i;
        this.speedBtns.forEach((x, j) => {
          const on = j === i;
          x.style.background = on ? "#22d3ee" : "rgba(0,0,0,0.35)";
          x.style.color = on ? "#04222b" : "#e2e8f0";
        });
      };
      this.speedBtns.push(b);
      speedBox.append(b);
    });

    opts.append(seedBox, speedBox);

    // jogar
    const play = document.createElement("button");
    play.textContent = "▶ JOGAR";
    Object.assign(play.style, {
      padding: "15px 60px",
      borderRadius: "16px",
      border: "none",
      background: "linear-gradient(135deg, #22d3ee, #34d399)",
      color: "#04222b",
      fontWeight: "900",
      fontSize: "clamp(17px,4vw,22px)",
      cursor: "pointer",
      font: "inherit",
      letterSpacing: "1px",
      boxShadow: "0 8px 30px rgba(34,211,238,0.35)",
    } as Partial<CSSStyleDeclaration>);
    play.onclick = () => {
      if (!this.ready || this.teams.length < 2) return;
      this.handlers.onStart({
        homeId: this.teams[this.homeIdx].id,
        awayId: this.teams[this.awayIdx].id,
        seed: this.seed,
        timeScale: Menu.SPEEDS[this.speedIdx].value,
        minutes: 90,
        physics: true,
      });
    };
    this.playBtn = play;

    const hint = el(
      "div",
      { fontSize: "12px", color: "#64748b", textAlign: "center", maxWidth: "520px" },
      "Dica: a física pode ser desligada na linha de comandos do servidor (--no-physics). " +
        "A mesma seed reproduz exatamente a mesma partida."
    );

    this.root.append(row, opts, play, hint);
    parent.append(this.root);
  }

  private playBtn: HTMLButtonElement;

  private buildPicker(label: string, onDir: (d: number) => void): HTMLElement {
    const card = el("div", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: "16px",
      padding: "14px 18px",
      minWidth: "min(240px, 42vw)",
    } as Partial<CSSStyleDeclaration>);
    card.append(el("div", { fontSize: "11px", letterSpacing: "2px", color: "#94a3b8", fontWeight: "800" }, label));

    const nav = el("div", { display: "flex", alignItems: "center", gap: "10px" } as Partial<CSSStyleDeclaration>);
    const left = this.arrow("‹", () => onDir(-1));
    const right = this.arrow("›", () => onDir(1));
    const body = el("div", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
      minWidth: "150px",
    } as Partial<CSSStyleDeclaration>);
    body.append(
      el("div", { width: "42px", height: "8px", borderRadius: "4px", background: "#334155" }, ""),
      el("div", { fontSize: "17px", fontWeight: "800", textAlign: "center" }, "…"),
      el("div", { fontSize: "12px", color: "#94a3b8", textAlign: "center" }, "a carregar…"),
      el("div", { fontSize: "11px", color: "#64748b", textAlign: "center" }, "")
    );
    nav.append(left, body, right);
    card.append(nav);
    // marcadores para atualizar depois
    (card as HTMLElement & { _body?: HTMLElement })._body = body;
    return card;
  }

  private arrow(glyph: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.textContent = glyph;
    Object.assign(b.style, {
      width: "38px",
      height: "38px",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(0,0,0,0.35)",
      color: "#fff",
      fontSize: "22px",
      cursor: "pointer",
      font: "inherit",
      lineHeight: "1",
    } as Partial<CSSStyleDeclaration>);
    b.onclick = fn;
    return b;
  }

  private pick(side: 0 | 1, dir: number): void {
    if (this.teams.length < 2) return;
    const n = this.teams.length;
    if (side === 0) {
      this.homeIdx = (this.homeIdx + dir + n) % n;
      if (this.homeIdx === this.awayIdx) this.homeIdx = (this.homeIdx + dir + n) % n;
    } else {
      this.awayIdx = (this.awayIdx + dir + n) % n;
      if (this.awayIdx === this.homeIdx) this.awayIdx = (this.awayIdx + dir + n) % n;
    }
    this.renderCards();
  }

  setTeams(teams: TeamInfo[]): void {
    this.teams = teams;
    this.ready = teams.length >= 2;
    if (teams.length >= 2) {
      this.homeIdx = 0;
      this.awayIdx = Math.min(1, teams.length - 1);
    }
    this.renderCards();
  }

  private renderCards(): void {
    this.renderCard(this.homeCard, this.teams[this.homeIdx]);
    this.renderCard(this.awayCard, this.teams[this.awayIdx]);
  }

  private renderCard(card: HTMLElement, team: TeamInfo | undefined): void {
    const body = (card as HTMLElement & { _body?: HTMLElement })._body;
    if (!body) return;
    if (!team) return;
    const [kit, , gk] = team.colors;
    body.replaceChildren();
    const swatch = el("div", {
      width: "56px",
      height: "12px",
      borderRadius: "6px",
      background: `linear-gradient(90deg, ${kit} 60%, ${gk} 60%)`,
    } as Partial<CSSStyleDeclaration>);
    body.append(
      swatch,
      el("div", { fontSize: "17px", fontWeight: "800", textAlign: "center" }, team.name),
      el("div", { fontSize: "12px", color: "#94a3b8", textAlign: "center" }, `${team.formation} · ${team.style}`),
      el("div", { fontSize: "11px", color: "#64748b", textAlign: "center" }, team.short)
    );
  }

  show(): void {
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }

  dispose(): void {
    this.root.remove();
  }
}
