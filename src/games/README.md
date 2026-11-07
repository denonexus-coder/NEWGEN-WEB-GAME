# 🕹️ Games — como adicionar um jogo ao launcher

Todo jogo é uma **pasta aqui dentro** com um `index.ts` que exporta um módulo
seguindo o contrato da engine. O launcher detecta automaticamente.

## Estrutura

```
src/games/
└── meu-jogo/
    ├── index.ts      ← obrigatório: export default GameModule
    ├── gameplay/     ← regras do jogo
    ├── scenes/       ← cenas/estádio/etc.
    └── assets/       ← texturas, sons (colocar em public/assets/ se for servido por URL)
```

## Contrato (padrão único)

```ts
// src/games/meu-jogo/index.ts
import type { GameModule } from '../../engine/types';

const game: GameModule = {
  id: 'meu-jogo',
  name: 'Meu Jogo',
  description: 'Descrição curta',
  version: '1.0.0',
  author: 'Seu Nome',
  // thumbnail: '/assets/meu-jogo/thumb.png',

  mount(ctx) {
    // ctx.THREE, ctx.render, ctx.input, ctx.audio, ctx.assets,
    // ctx.physics, ctx.events, ctx.time, ctx.settings

    const scene = new ctx.THREE.Scene();
    const camera = new ctx.THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
    camera.position.set(0, 2, 5);
    ctx.render.setTarget(scene, camera); // o loop renderiza sozinho

    return {
      update(dt) {
        // lógica por frame
      },
      pause() {},
      resume() {},
      dispose() {
        ctx.render.clearTarget();
      },
    };
  },
};

export default game;
```

## Regras

1. **Nunca importe módulos internos da engine dentro do jogo** — use `ctx.*`.
2. **`dispose()` é obrigatório na prática**: libere geometrias, materiais,
   sons e pareça loops. O launcher chama ao sair/reiniciar.
3. `id` deve ser único (usado como chave no registry).
4. Jogos também podem ser **importados de fora** (Settings → Importar),
   seguindo o mesmo formato em JS puro.

Ver: `src/launcher/gameRegistry.ts` e `PLANO-ENGINE.md`.
