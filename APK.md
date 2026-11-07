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
