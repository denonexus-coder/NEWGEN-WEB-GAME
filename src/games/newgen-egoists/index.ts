import type { GameModule } from '../../engine/types';

/**
 * Adapter do clássico NEWGEN × NEWEGOISTS.
 *
 * O jogo roda dentro de um iframe apontando para
 * public/games/newgen-egoists/index.html — mesma lógica, mesma UI,
 * mesmo save (localStorage `ngne2`), com Three.js r128 local.
 * 100% offline: nenhum download em runtime.
 *
 * Ponte com o launcher (jogo expõe `window.ngSaveNow`):
 * - pause()/resume()  → postMessage {ng:'pause'|'resume'} → menu de pausa do jogo;
 * - dispose()         → ngSaveNow() guarda snapshot + save ANTES de remover o iframe,
 *                       e congela a partida atual (regras R2/R3 do jogo).
 */
type GameWin = Window & { ngSaveNow?: () => void };

const game: GameModule = {
  id: 'newgen-egoists',
  name: 'NEWGEN · NEWEGOISTS',
  description: 'Futebol 3D + gestão mundial — o clássico, agora dentro do launcher',
  version: '2.0.0',
  author: 'NEWGEN',

  async mount(ctx) {
    // Este jogo não usa a engine 3D do launcher: para o loop para não
    // consumir CPU/GPU atrás do iframe.
    ctx.loop.stop();

    const frame = document.createElement('iframe');
    frame.title = 'NEWGEN · NEWEGOISTS';
    frame.src = new URL('games/newgen-egoists/index.html', document.baseURI).href;
    // position:relative (em fluxo) = ocupa a CAIXA DE CONTEÚDO do container,
    // que já respeita os safe-areas — notch/lateral nunca cobrem os controles.
    frame.style.cssText =
      'position:relative;display:block;width:100%;height:100%;border:0;z-index:0;background:#050b14;';
    (ctx.canvas.parentElement ?? document.body).appendChild(frame);

    // Espera o iframe carregar antes de reportar ready — evita ecrã negro
    // enquanto o Three.js e o jogo ainda não inicializaram dentro do WebView.
    await new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error('iframe falhou ao carregar'));
      setTimeout(() => reject(new Error('iframe timeout')), 10000);
    });

    const post = (ng: string) => {
      try {
        frame.contentWindow?.postMessage({ ng }, '*');
      } catch {
        /* iframe já destruído — ignora */
      }
    };

    return {
      pause() {
        post('pause');
      },
      resume() {
        post('resume');
      },
      dispose() {
        // reinicia o loop do launcher para o canvas ficar visível de novo
        try { ctx.loop.resume(); } catch { /* best-effort */ }
        // guarda imediatamente: snapshot da partida em curso + save no localStorage
        // (mesma origem) — nada se perde ao sair para o launcher
        try {
          (frame.contentWindow as GameWin | null)?.ngSaveNow?.();
        } catch {
          /* best-effort */
        }
        frame.remove();
      },
    };
  },
};

export default game;
