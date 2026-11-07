# 📦 Como gerar o APK do NewGen Launcher

O APK é uma **WebView (Android) rodando este web app** — offline, sem servidor.
Os jogos ficam embutidos no bundle ou são importados localmente (IndexedDB).

---

## Opção 1 — Build automático por GitHub Actions (recomendado ✅)

Sem precisar de Android Studio na sua máquina:

1. Dê `git push` para a branch `main` (ou rode o workflow manualmente em
   **Actions → Build APK (NewGen Launcher) → Run workflow**).
2. Ao finalizar, baixe o artefato **`NEWGEN-LAUNCHER-APK`** em
   **Actions → último run → Artifacts**.
3. Instale o `app-debug.apk` no aparelho.

> O workflow roda: `npm install → vite build → cap add/sync android → gradlew assembleDebug`.

---

## Opção 2 — Build local (requer Android Studio / SDK)

```bash
npm install --legacy-peer-deps
npm run build          # gera dist/
npm run apk:init       # cria pasta android/ (1ª vez só)
npm run apk:sync       # copia dist/ para android/app/src/main/assets/public
npm run apk:build      # gradlew assembleDebug
# APK em: android/app/build/outputs/apk/debug/app-debug.apk
```

Para release assinado: `./gradlew assembleRelease` + keystore no
`android/app/build.gradle` (signingConfig).

---

## Como os jogos entram no APK

| Forma | Como funciona |
|---|---|
| **Embutidos (interno)** | Coloque o jogo em `src/games/<id>/index.ts` antes do build — o registry detecta sozinho. |
| **Importado (local)** | No launcher: botão **Importar** → escolhe `.js` (+ `manifest.json` opcional). Fica salvo no **IndexedDB** do aparelho — continua funcionando offline. |

### Formato do pacote importável

```
meu-jogo/
├── manifest.json   # { "id", "name", "version", "author", "description" }
├── main.js         # export default { id, name, mount(ctx) {...} }
└── thumb.png       # opcional (capa)
```

Selecione os arquivos juntos no seletor (ou apenas o `.js`).

---

## Notas offline

- Nenhuma fonte/CDN/ API externa é usada — tudo é bundleado na build.
- `base: './'` no Vite garante que o WebView carregue de `file://`/local.
- Jogos importados usam blob URLs locais — nada sai do aparelho.

## Notas de orientação (landscape)

- O app é **travado em `sensorLandscape`** (paisagem, girando nos dois sentidos)
  direto no `AndroidManifest.xml`, aplicado por step no CI antes do Gradle —
  sem plugin, sem código de runtime.
- O launcher e o GameHost respeitam `env(safe-area-inset-*)`: recorte (notch) e
  barra de gestos nunca cobrem botões nem controles do jogo.

## 🎮 NEWGEN · NEWEGOISTS (jogo embutido)

O jogo clássico (futebol 3D + gestão mundial) corre dentro de um iframe
apontando para `public/games/newgen-egoists/` — 10 módulos `<script>` + 3 CSS,
Three.js r128 local (`public/vendor/three.min.js`), **100% offline**.
Save em `localStorage` chave `ngne2` (mesma origem iframe ↔ launcher).

### Regras da competição (v1.3)

| # | Regra |
|---|---|
| R1 | **Sem botões de velocidade** — tudo corre a tempo real (1×). |
| R2 | Sair de uma partida **congela-a**; re-entra retoma do **snapshot exato** (inclusive depois de matar a app). |
| R3 | App em background → **tudo congela** (`visibilitychange` guarda e pausa). |
| R4/R5 | A minha partida só tem **Jogar** (nunca "Assistir") — não corre sem mim. |
| R6/R7 | Falta ao kickoff → notificação + **1 dia de prazo** → **forfeit 0–3** + multa `max(150, 10% do caixa)` + OVR −1 + entrada no diário. |
| R8 | Partidas que nunca vi seguem o calendário e **produzem resultado** sozinhas no fim da janela. |
| R9 | Rodada completa → **nova rodada** agendada automaticamente. |
| R10 | Kickoffs escalonados **T+0/5/10/15 min**. |

### Arquitetura dos módulos (`public/games/newgen-egoists/js/`)

```
00-names    nomes únicos globais + treinadores     50-sim    simulação (lógica original intacta)
10-world    constantes, equipas, save, migração    60-evolve evolução, época, quick, forfeit
20-calendar datas, janelas, estados, formatos      70-3d     Three.js: cena, personagens, câmara
30-clock    relógio do mundo (prazos/auto-sim)     80-controls joystick + teclado
40-match    entrar/congelar/retomar/snapshots      90-ui     menus, HUD, pausa, modais, loop
```

A ordem dos `<script>` no `index.html` é a dependência; referências cruzadas
entre ficheiros só podem ser resolvidas em tempo de execução.

### Ponte jogo ↔ launcher

- `postMessage {ng:'pause'|'resume'}` (ESC/⏸ no jogo) ↔ overlay do GameHost;
- `window.ngSaveNow()` chamado pelo adapter **sincronamente** em `dispose()`
  antes de remover o iframe (guarda snapshot + save, congela a partida).
