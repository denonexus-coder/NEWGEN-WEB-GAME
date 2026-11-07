# 🚀 PLANO — NewGen Engine (motor gráfico + física + áudio próprio)

> **Objetivo:** criar do zero um motor web de alto desempenho capaz de rodar
> 3D realista, 2D, animações, física realista e som — com performance máxima.
>
> **Lema:** *data-oriented, zero-lixo no frame, WebGPU-first, medir antes de otimizar.*

---

## 0. Princípios inegociáveis

1. **Data-Oriented Design** — ECS com SoA (Structure of Arrays), cache-friendly.
2. **WebGPU-first** — render moderno (compute shaders, indirect draw) com **fallback WebGL2**.
3. **WASM + SIMD** — hot paths (física, matemática, partículas) em Rust compilado p/ WASM.
4. **Multi-threading** — Job System sobre Web Workers (física e culling fora da thread principal).
5. **Zero alocação no frame** — memory pools, reuso de buffers.
6. **Profiler do dia 1** — HUD de ms/frames/draw calls antes de qualquer código "bonito".
7. **Entregável testável a cada fase** — nada de 6 meses sem rodar.

---

## 1. Stack Tecnológico (definida)

| Camada | Tecnologia | Motivo |
|---|---|---|
| Estrutura do motor | **TypeScript** (strict) | integração nativa com o ecossistema web/game |
| Hot paths | **Rust → WASM (wasm-bindgen, SIMD128)** | 10-50x mais rápido que JS em física/math |
| Gráficos | **WebGPU** (WGSL) + **WebGL2** (GLSL) fallback | futuro padrão, compute + performance |
| Áudio | **Web Audio API** + AudioWorklet | DSP de baixa latência |
| Build | **Vite + esbuild + wasm-pack** | dev rápido, bundle enxuto |
| Testes | **Vitest** + bench (criterion p/ Rust) | regressão de performance |
| Assets | **glTF 2.0**, KTX2/BasisU, OGG/Opus | padrões da indústria |

---

## 2. Arquitetura (camadas)

```
┌─────────────────────────────────────────────────┐
│                    JOGO / APP                   │
├─────────────────────────────────────────────────┤
│  CORE:  ECS (SoA) · Job System · Events · Time │
├──────────┬──────────┬──────────┬────────────────┤
│ FÍSICA   │ RENDER3D │ RENDER2D │ ÁUDIO          │
│ (WASM)   │ PBR/CSM  │ batching │ mixer/HRTF    │
├──────────┴──────────┴──────────┴────────────────┤
│  ANIMAÇÃO (esqueletal/IK) · UI · PARTICLE SYSTEM│
├─────────────────────────────────────────────────┤
│  BACKEND: WebGPU │ WebGL2 │ WebAudio │ WASM/SIMD│
└─────────────────────────────────────────────────┘
```

**Decisões de arquitetura:**
- **ECS próprio** (não usar biblioteca pronta) — controle total da memória.
- **Render Graph** — passos declarativos (opaque → shadow → transparent → post).
- **Frontend inexistente no core** — o motor não conhece React; a UI do jogo fica *em cima* (HTML/HUD) ou *dentro* (canvas UI do motor).

---

## 3. Roadmap em Fases

### ▶ Fase 0 — Fundação (aqui começamos)
- [ ] Repo, build TS + Rust/WASM funcionando
- [ ] Loop de frame com fixed-timestep + profiler (ms, FPS, draw calls)
- [ ] ECS mínimo (entidades, componentes SoA, systems)
- [ ] **Entregável:** cubo 3D girando a 60+ FPS com HUD de performance

### ▶ Fase 1 — Render 3D básico
- [ ] Device/WebGPU init + fallback WebGL2
- [ ] Câmera (perspective/ortho, controles), mesh, matrizes
- [ ] Shaders: iluminação direcional + Blinn-Phong
- [ ] Carregador **glTF** + texturas (mipmaps, filtering anisotrópico)
- [ ] **Entregável:** cena com modelo/textura, câmera livre

### ▶ Fase 2 — Realismo visual (PBR)
- [ ] Material **PBR Cook-Torrance/GGX** (albedo, normal, roughness, metallic, AO)
- [ ] **IBL** (HDR/HDRI: irradiance + prefiltered specular + BRDF LUT)
- [ ] Sombras: **CSM** (cascaded shadow maps) + PCF/PCSS
- [ ] Pós-processamento: **bloom, ACES tonemapping, SSAO, TAA, vignette**
- [ ] Otimizações: frustum culling, instancing, LOD, occlusion culling
- [ ] **Entregável:** demo "material ball" com iluminação igual à de engine comercial

### ▶ Fase 3 — Render 2D + UI do motor
- [ ] Sprite batcher (1 draw call p/ milhares de sprites)
- [ ] Text atlas, nine-slice, parallax, shaders 2D (distortion, outline)
- [ ] UI interna: painéis, botões, textos (canvas-based) — para menus do launcher
- [ ] **Entregável:** menu 2D animado + HUD integrados ao loop 3D

### ▶ Fase 4 — Física realista (WASM)
- [ ] Fixed step determinístico (60/120 Hz) + accumulator
- [ ] Broadphase: **BVH dinâmico** (SAH)
- [ ] Narrowphase: **GJK/EPA** + colisão de formas primitivas
- [ ] Solver: **Sequential Impulse / PGS** com warm starting + restitution/friction
- [ ] **CCD** (sweep and prune) p/ objetos rápidos (bola!)
- [ ] Joints (hinge, ball, distance), ragdoll
- [ ] Integração **SIMD + threads** (workers)
- [ ] (Opcional p/ avançado) soft body / cloth / fluidos simples
- [ ] **Entregável:** pilha de caídas estável + bola com bounce realista

### ▶ Fase 5 — Animação
- [ ] Skeletal animation (matrizes de osso, compressão de quaternion)
- [ ] Blend tree: idle/run/shot, crossfade, additive layers
- [ ] **IK**: two-bone + FABRIK (pés no chão, mãos na bola)
- [ ] Ragdoll ↔ animação (blend físico/kinemático)
- [ ] Spring bones (segundário: cabelo, bandagens)
- [ ] **Entregável:** personagem correndo/interagindo com física

### ▶ Fase 6 — Áudio
- [ ] Mixer (buses: música/SFX/ambiente), volume por canal
- [ ] Espacial: **PannerNode + HRTF**, roloff, Doppler
- [ ] Reverb de convolução (ambientes: estádio, sala)
- [ ] Streaming de música, pooling de SFX, AudioWorklet p/ DSP próprio
- [ ] **Entregável:** som de bola/estádio espacial funcionando

### ▶ Fase 7 — Pipeline de Assets + Ferramentas
- [ ] Importador glTF → formato binário próprio (carregamento instantâneo)
- [ ] Compressão de texturas **KTX2/ASTC** + streaming
- [ ] Conversão de áudio → Opus/OGG
- [ ] Hot reload de assets em runtime
- [ ] **Entregável:** pasta `assets/` versionada, load < 1s

### ▶ Fase 8 — Otimização definitiva (meta 120 FPS)
- [ ] Compute culling + **indirect drawing** (WebGPU)
- [ ] Texture streaming por tiles, virtual texturing leve
- [ ] Job system completo (work stealing)
- [ ] Memory arenas/pools, evictor de GPU resources
- [ ] Benchmarks automatizados + gate de regressão
- [ ] **Entregável:** cena stress test (1M triângulos, 10k objetos) a 120 FPS

---

## 4. Metas de performance (frame budget 16.6 ms @60fps)

| Sistema | Budget |
|---|---|
| Render (CPU submit + GPU) | ≤ 6 ms |
| Física (WASM, workers) | ≤ 3 ms |
| Animação | ≤ 1.5 ms |
| Áudio + UI + misc | ≤ 1 ms |
| **Margem/jitter** | **≥ 5 ms** |
| Meta estendida | 8.3 ms @ **120 FPS** |

**Regras:** draw calls < 500 · triângulos visíveis < 2M · 0 alocações GC por frame.

---

## 5. Fora de escopo (por enquanto)

- ❌ Compilador de shader próprio (usamos WGSL/GLSL + minificação)
- ❌ Editor visual estilo Unity (v1 é API/code-first)
- ❌ Multiplayer/rollback netcode
- ❌ Suporte a navegadores antigos (WebGL1)

---

## 6. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| WebGPU indisponível em alguns devices | Fallback WebGL2 desde a Fase 1 |
| Física do zero é o maior desafio | Fase 4 começa com 2D/simples e escala |
| Escopo gigante → travar | Uma fase = um entregável rodando |
| Termux/Android (dev local limitado) | Tudo via browser; testes reais em device |

---

## 7. Primeiro passo concreto

**Fase A — Launcher (APPLY ✅ feito):**
- [x] Estrutura `src/launcher/` + `src/engine/` + `src/games/`
- [x] Launcher React: Início, Biblioteca, Configurações (offline, localStorage)
- [x] GameHost: sobe/derruba jogos, pausa (ESC), FPS, resize
- [x] Registry: jogos embutidos (`src/games/`) + importação local (IndexedDB)
- [x] Engine unificada: loop, input, áudio (buses), assets (cache), render (SRGB+ACES), física (interface p/ Rapier)
- [x] Capacitor + `APK.md` + workflow `build-apk.yml` → gera APK

**Próximos passos:**
- [ ] Integrar o jogo do usuário como primeiro plugin (`src/games/<id>/`) — aguardando o jogo
- [ ] Fase B: extrair lógica restante do futebol antigo para a engine
- [ ] Fase C: física Rapier (WASM) substituindo `NullPhysicsWorld`
