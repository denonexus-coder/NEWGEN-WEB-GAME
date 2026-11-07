import * as THREE from 'three';
import { GameLoop } from './core/loop';
import { EventBus } from './core/events';
import { InputManager } from './input/inputManager';
import { AudioManager } from './audio/audioManager';
import { AssetManager } from './assets/assetManager';
import { createRenderModule, type RenderModule } from './render/renderer';
import { NullPhysicsWorld } from './physics/physics';
import type { EngineContext, EngineHandle, EngineSettings, GameHandle, QualityLevel } from './types';

/**
 * Cria e conecta todos os módulos da engine em um único lugar.
 * Ordem do frame: game.update → game.lateUpdate → input.endFrame → render.
 */
export function createEngine(canvas: HTMLCanvasElement, settings: EngineSettings): EngineHandle {
  const events = new EventBus();
  const loop = new GameLoop();
  const render: RenderModule = createRenderModule(canvas, settings.quality);
  const input = new InputManager();
  input.attach(canvas);
  const audio = new AudioManager();
  audio.setVolumes({
    master: settings.masterVolume,
    music: settings.musicVolume,
    sfx: settings.sfxVolume,
  });
  const assets = new AssetManager();
  assets.setMaxAnisotropy(render.renderer.capabilities.getMaxAnisotropy());
  const physics = new NullPhysicsWorld();

  let game: GameHandle | null = null;

  const ctx: EngineContext = {
    canvas,
    THREE,
    render,
    loop,
    events,
    input,
    audio,
    assets,
    physics,
    time: loop.time,
    settings,
  };

  loop.onUpdate = (dt) => game?.update?.(dt);
  loop.onLateUpdate = (dt) => {
    game?.lateUpdate?.(dt);
    input.endFrame();
  };
  loop.onRender = () => render.render();
  loop.start();

  return {
    ctx,
    setGame(g) {
      game = g;
    },
    resize(w, h) {
      render.resize(w, h);
      game?.resize?.(w, h);
    },
    setQuality(quality: QualityLevel) {
      render.setQuality(quality);
      settings.quality = quality;
    },
    dispose() {
      try {
        game?.dispose?.();
      } catch (err) {
        console.error('[engine] dispose do jogo falhou:', err);
      }
      game = null;
      loop.dispose();
      input.dispose();
      audio.dispose();
      assets.dispose();
      physics.dispose();
      render.dispose();
      events.clear();
    },
  };
}
