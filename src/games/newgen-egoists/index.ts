import type { GameModule } from '../../engine/types';

/**
 * Adapter do clássico NEWGEN × NEWEGOISTS.
 *
 * O jogo roda INTACTO dentro de um iframe apontando para
 * public/games/newgen-egoists/index.html — mesma lógica, mesma UI,
 * mesmo save (localStorage `ngne2`), com Three.js r128 local.
 * 100% offline: nenhum download em runtime.
 */
const game: GameModule = {
  id: 'newgen-egoists',
  name: 'NEWGEN · NEWEGOISTS',
  description: 'Futebol 3D + gestão mundial — o clássico, agora dentro do launcher',
  version: '1.0.0',
  author: 'NEWGEN',

  mount(ctx) {
    // Este jogo não usa a engine 3D do launcher: para o loop para não
    // consumir CPU/GPU atrás do iframe.
    ctx.loop.stop();

    const frame = document.createElement('iframe');
    frame.title = 'NEWGEN · NEWEGOISTS';
    frame.src = new URL('games/newgen-egoists/index.html', document.baseURI).href;
    frame.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:0;background:#0a1220;';
    (ctx.canvas.parentElement ?? document.body).appendChild(frame);

    return {
      dispose() {
        frame.remove();
      },
    };
  },
};

export default game;
