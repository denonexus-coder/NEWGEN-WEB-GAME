# ⚽ PLANO — Football AI no NewGen Launcher

> **Divisão (confirmada):** *server integrated offline* roda **toda a lógica** (12 engines
> de IA + simulação + física) num **Web Worker**; o *client* só **renderiza** (three.js
> do launcher) e interpola. Modelo Minecraft (integrated server), offline total.
>
> **Ordem de trabalho (definida):** ① server inteiro funcional (já temos a IA,
> falta física básica) → ② jogo real funcional no browser → ③ client completo →
> ④ build APK no GitHub CI → utilizador instala e testa.

---

## 0. O que já existe (inventário)

### Em `AI-engine` (fonte da verdade da IA)
- **12 engines** TypeScript puros (percepção → personalidade → emoção → decisão →
  criatividade → memória → aprendizagem → rivalidade → tática → pathfinding → GR → behavior)
- **Simulação 11v11** (`src/benchmark/tournament/simulation.ts`) + **6 equipas**
  (`teams.ts`) já calibrada (scorelines plausíveis, ~900 passes/jogo, 71% defesas GR)
- **10 benchmarks = 6700/6700 (100%)**, determinística por semente
- Física actual: **cinemático-probabilística** (sem gravidade/colisões) ← a evoluir

### Em `NEWGEN-WEB-GAME` (o anfitrião)
- Launcher React (Home/Library/Settings) + registry que **auto-detecta**
  `src/games/*/index.ts` como `GameModule`
- Engine própria: `GameLoop` (rAF), `EventBus`, input/áudio/assets,
  `RenderModule` three.js (WebGL, ACES, sombras), contrato `PhysicsWorld`
  (hoje `NullPhysicsWorld` — placeholder preparado)
- Contrato de jogo: `mount(ctx) → GameHandle` (update/lateUpdate/pause/dispose)
- Capacitor APK (`com.newgen.launcher`) + **CI já pronta**
  (`build-apk.yml`: typecheck → vite build → cap sync → gradlew → artefato
  `NEWGEN-LAUNCHER-APK`)

---

## 1. Arquitetura-alvo

```
┌────────────────────────────────────────────────────────────────┐
│  SERVER — Web Worker (offline, autoritativo)                   │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ 12 engines   │ │ simulation   │ │ física básica           │ │
│  │ (AI-engine)  │ │ (árbitro,    │ │ bola: gravidade/quique/ │ │
│  │ decidem      │ │  regras,     │ │  arrasto/balizas        │ │
│  │              │ │  probabilids)│ │ jogadores: accel +      │ │
│  │              │ │              │ │  separação (sem overlap)│ │
│  └──────┬───────┘ └──────┬───────┘ └───────────┬─────────────┘ │
│         └───────── tick fixo 20 Hz ────────────┘               │
│                    GameServer.tick()                           │
│         Snapshot(Float32Array) + Events[] + stats              │
└────────────────────────┬───────────────────────────────────────┘
                         │ postMessage (transferable)
┌────────────────────────▼───────────────────────────────────────┐
│  CLIENT — main thread (só renderiza)                           │
│  GameModule (src/games/football-ai)                            │
│   ├─ bridge: worker + fila de snapshots                        │
│   ├─ interpolador (alpha entre 2 snapshots, 60 fps)            │
│   ├─ view three.js: campo 100×65, 22 jogadores, bola, balizas  │
│   └─ HUD: placar, relógio, posse, velocidade, pausa, equipas   │
│  Comandos client→server: init/pause/speed/tática/substituição  │
└────────────────────────────────────────────────────────────────┘
```

**Regra de ouro:** `src/server/**` **nunca** importa `src/engine/**` (DOM/three) —
corre igual em Worker, em Node (testes/torneios) e futuramente em worker de
performance. `src/games/**` (client) só consome **snapshots** — nunca o estado interno.

---

## 2. Estrutura final (árvore)

```
NEWGEN-WEB-GAME/
├── src/
│   ├── engine/                       ← engine existente (NÃO muda)
│   │   └── physics/physics.ts        ← contrato PhysicsWorld (já existe)
│   │
│   ├── shared/                       ← NOVO — tipos partilhados server↔client
│   │   └── protocol.ts               ← Snapshot | Event | Command | MsgIn/MsgOut
│   │
│   ├── server/                       ← NOVO — TUDO o que é lógica (DOM-free)
│   │   ├── ai/                       ← SINCronizado do AI-engine
│   │   │   ├── core/                 (types, math, config, blackboard, time)
│   │   │   ├── 01_perception_engine/ … 12_behavior_execution/
│   │   │   └── AI-VERSION            ← hash de origem (rastreio da sync)
│   │   ├── sim/
│   │   │   ├── simulation.ts         ← do AI-engine (árbitro do jogo)
│   │   │   ├── teams.ts              ← 6 equipas do torneio
│   │   │   └── match-clock.ts        ← NOVO: relógio 90', timeScale, pausa
│   │   ├── physics/
│   │   │   └── ball-physics.ts       ← NOVO: física básica (ver §5)
│   │   ├── host/
│   │   │   ├── worker.ts             ← NOVO: entrada do Web Worker
│   │   │   └── node-host.ts          ← NOVO: host p/ Node (CLI + testes)
│   │   └── server-core.ts            ← NOVO: GameServer (init/tick/snapshot/commands)
│   │
│   ├── games/
│   │   └── football-ai/              ← NOVO — o jogo (GameModule, auto-registado)
│   │       ├── index.ts              ← mount(ctx) → GameHandle
│   │       ├── match-client.ts       ← ponte ao worker + fila de snapshots
│   │       ├── interpolator.ts       ← alpha entre snapshots
│   │       ├── view.ts               ← three.js: campo/jogadores/bola/câmara
│   │       └── hud.ts                ← placar, relógio, stats, menus
│   │
│   └── launcher/ … main.tsx          ← existentes (inalterados)
│
├── scripts/
│   └── sync-ai.mjs                   ← NOVO: copia AI-engine → src/server/{ai,sim}
├── src/server/__tests__/             ← NOVO: testes do server (tsx)
│
├── PLANO-ENGINE.md                   ← existente (motor gráfico próprio — paralelo)
├── PLANO-FOOTBALL-AI.md              ← este documento
└── .github/workflows/build-apk.yml   ← existente (+ step de testes do server)
```

---

## 3. Fases e entregáveis

### ▶ M1 — SERVER INTEIRO FUNCIONAL (headless) ← começamos aqui
- [ ] **Higiene de repo:** commit do estado atual (ficheiros do jogo antigo removidos)
- [ ] **Sync:** `scripts/sync-ai.mjs` copia `AI-engine/src/{core,01..12}` →
      `src/server/ai/` e `benchmark/tournament/{simulation,teams}.ts` → `src/server/sim/`
      (estrutura de pastas preservada → imports relativos intactos; escreve `AI-VERSION`)
- [ ] **Protocolo:** `src/shared/protocol.ts` (tipos puros, §4)
- [ ] **Física básica:** `src/server/physics/ball-physics.ts` (§5)
- [ ] **GameServer:** `src/server/server-core.ts` — `init(seed, teams, timeScale)` →
      `tick(dt)` → `snapshot()` + `events()`; recebe `Command`s
- [ ] **Hosts:** `node-host.ts` (CLI: `npm run server:match`) e `worker.ts`
- [ ] **Testes:** `npm run test:server` (tsx):
  1. jogo completo 90' headless termina com placar válido
  2. determinismo (mesmo seed → mesmo placar + mesmas stats)
  3. física: bola quica com energia decrescente, sem NaN em 10k passos,
     jogadores não se sobrepõem (distância mínima ≥ 0.9·r)
  4. protocolo: snapshot sem NaN, arrays com tamanho certo, eventos serializáveis
- [ ] **Critério de aceitação:** typecheck verde + testes verdes +
      `npm run server:match` imprime scoreline de uma partida completa, no launcher repo

### ▶ M2 — JOGO REAL FUNCIONAL (browser, dev)
- [ ] `src/games/football-ai/index.ts` — `mount(ctx)`: cria worker
      (`new Worker(new URL('../../server/host/worker.ts', import.meta.url), {type:'module'})`),
      envia `init`, liga snapshots→interpolador→view
- [ ] `view.ts`: plano de campo (grama), 22 jogadores (cápsulas + cor de equipa + nº),
      bola (esfera), balizas, sombra, **câmara broadcast** lateral + modo seguir bola
- [ ] `interpolator.ts`: lerp entre 2 últimos snapshots (alpha = tempo desde t1 / Δt),
      bola extrapola por velocidade
- [ ] `hud.ts`: placar, relógio do jogo, posse %, velocidade (1×/2×/4×/MAX), pausa (ESC),
      menu de seleção das **6 equipas** (usa `createTournamentTeams()`)
- [ ] Input: toque/espaço para câmara, botões HUD (usar `ctx.input`/overlay HTML)
- [ ] **Critério:** `npm run dev` → partida jogável a 60 fps, lógica toda no worker
      (main thread nunca trava), placar/estatísticas coerentes com o server

### ▶ M3 — APK (o teu teste final)
- [ ] `git push` para `main` → CI `build-apk.yml` (typecheck → build → cap sync →
      gradlew) → artefato **`NEWGEN-LAUNCHER-APK`**
- [ ] Instalar no telemóvel, testar: boot do launcher → jogo → partida → pausa → sair
- [ ] Ajustes (landscape já travado no workflow, safe-areas já tratados no `GameHost`)
- [ ] **Critério:** APK instala e a partida corre no dispositivo

---

## 4. Protocolo exacto (`src/shared/protocol.ts`)

```ts
// ── client → server ─────────────────────────────────────────
type Command =
  | { type: 'init'; seed: number; homeId: number; awayId: number;
      timeScale: number; halfMinutes: number }        // halfMinutes = 45 (ou testes: 5)
  | { type: 'pause' } | { type: 'resume' }
  | { type: 'speed'; timeScale: number }               // 1 | 2 | 4 | MAX
  | { type: 'tactic'; teamId: number; mode: 'balanced'|'attack'|'defend' }  // v2
  | { type: 'substitute'; teamId: number; out: number; in: number };        // v2

type MsgIn = { kind: 'command'; cmd: Command } | { kind: 'ping'; t: number };

// ── server → client ─────────────────────────────────────────
interface Snapshot {
  seq: number;              // monotónico (perda detectável)
  tick: number;
  gameTime: number;         // segundos de jogo (0..5400)
  players: Float32Array;    // 22 × STRIDE: x, y, z, yaw, action(0..), speed
  ball: Float32Array;       // 6: x, y, z, vx, vy, vz
  scoreHome: number; scoreAway: number;
  possession: 0 | 1 | 2;    // 0 = disputada
  statsSeq: number;         // stats actualizadas 1×/s
}
interface MatchStats {      // 1×/s
  home: SideStats; away: SideStats;   // posse, passes ±, remates, defesas, desarmes…
}
type GameEvent =
  | { t: number; type: 'goal';      team: 1|2; scorer: string; score: [number,number] }
  | { t: number; type: 'shot';      team: 1|2; onTarget: boolean }
  | { t: number; type: 'save';      team: 1|2 }
  | { t: number; type: 'kickoff' | 'halftime' | 'fulltime' };

type MsgOut =
  | { kind: 'ready'; teams: TeamInfo[] }
  | { kind: 'snapshot'; snap: Snapshot }                 // ball/players transferidos
  | { kind: 'stats'; stats: MatchStats }
  | { kind: 'events'; events: GameEvent[] }
  | { kind: 'pong'; t: number };
```

- `Float32Array` **transferido** (`postMessage(msg, [buf])`) — zero cópia, zero alloc por tick
- `seq` permite ao client detectar snapshots perdidos/atrasados (só renderiza o mais recente)
- Tudo **tipos puros** — o mesmo ficheiro serve Worker, Node e testes

## 5. Física básica (escopo de M1)

| Corpo | Modelo |
|---|---|
| **Bola** | esfera r=0.11 m; gravidade −9.81; arrasto linear; restituição chão **0.65**; fricção de rolagem; colisão com **postes/trave** das balizas (cilindros); substeps ≤ 0.02 s |
| **Jogadores** | **cinemáticos**: velocidade máxima = `pace`-derivada, aceleração/desaceleração limitadas; raio 0.5 m; **separação suave** (nunca se sobrepõem, empurrão proporcional à sobreposição) |
| **Passe/Remate** | deixam de ser teleporte: **impulso** na bola (velocidade para chegar ao alvo); o rececionador recebe quando a bola entra no seu alcance → a **probabilidade** continua a vir dos engines (`evaluatePass`/`evaluateSave`); adversário no caminho → interceção como hoje |
| **Reinícios** | fora de jogo/lanço lateral/canto **fora do escopo** (a regra actual — posse cede por interceção/desarme — mantém-se) |

**Determinismo:** ordem de actualização fixa, float64, mesmo seed → mesmo jogo
(a física entra no fluxo do seed do `Math.random` stub, como já faz a simulação).

## 6. Tick, tempo e desempenho

- **Lógica: tick fixo 20 Hz (dt = 0.05 s)** no worker, com acumulador e *catch-up limitado*
  (máx. N ticks por ciclo — worker nunca bloqueia a espera)
- **timeScale** (1×/2×/4×/MAX): multiplica os ticks lógicos por segundo de parede;
  **MAX = modo torneio** (dt 0.5 — caminho já calibrado a ~9714 ticks/s)
- **Snapshots: 20/s** (cada tick) — 22×6 floats + 6 floats = trivial
- **Client:** render a rAF (60+ fps) com interpolação — nunca espera pelo server
- **Testes/torneios:** mesmo `server-core` em Node (`node-host.ts`) — sem DOM, sem worker

## 7. Sincronização AI-engine → launcher

```bash
# a correr de NEWGEN-WEB-GAME:
node scripts/sync-ai.mjs --from ../AI-engine
# copia: src/core, src/01..12        → src/server/ai/
#         src/benchmark/tournament/*  → src/server/sim/   (simulation.ts, teams.ts)
# escreve src/server/ai/AI-VERSION com hash dos ficheiros
```
- **AI-engine continua a ser o laboratório:** os 10 benchmarks (6700/6700) correm lá
  como sempre; o launcher recebe um *snapshot* sincronizado versionado
- Ordem de trabalho: mudar IA → correr benchmarks no AI-engine → `sync-ai` →
  `npm run lint` + `npm run test:server` no launcher → commit

## 8. Riscos conhecidos + mitigações

| Risco | Mitigação |
|---|---|
| Launcher usa **TS 7** + `isolatedModules`; código do AI-engine foi escrito p/ TS 5.3 strict | `npm run lint` após cada sync; corrigir barrels (`export type`) no sync; se necessário, pin de versão TS |
| APIs Node no código da IA (`process`, `require`) | grep no script de sync → falha o sync se encontrar (o código actual é puro, `performance.now()` existe no browser ✓) |
| Worker no WebView do Capacitor | `new Worker(new URL(...), {type:'module'})` é suportado no Chrome/WebView moderno; fallback: embutir worker como blob (só se falhar) |
| CI sem testes de servidor | adicionar step `npm run test:server` ao `build-apk.yml` (M1) |
| Offline total | zero CDN/Google Fonts/APIs — tudo no bundle (o launcher já funciona assim ✓) |

## 9. Comandos essenciais

```bash
# M1 — server
node scripts/sync-ai.mjs --from ../AI-engine
npm run lint                # typecheck
npm run test:server         # testes headless do server
npm run server:match        # partida completa na CLI (node-host)

# M2 — jogo no browser
npm run dev                 # http://localhost:3000 → launcher → Football AI

# M3 — APK
git push origin main        # CI → artefato NEWGEN-LAUNCHER-APK
```

---

### Resumo da ordem
1. **M1 server** (sync IA + física básica + protocolo + worker + testes) — *headless, provável*
2. **M2 jogo** (GameModule + three.js + HUD + seleção de equipas) — *jogável no browser*
3. **M3 APK** (push → CI → artefato → instalas e testas no telemóvel)
