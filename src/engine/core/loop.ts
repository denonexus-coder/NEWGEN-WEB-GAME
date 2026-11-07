import type { TimeInfo } from '../types';

const MAX_DELTA = 0.1; // 100ms — evita "explosão" de física ao voltar do background

/**
 * Game loop próprio: rAF + delta clamp + FPS suavizado + timeScale.
 * Update → LateUpdate → Render, nessa ordem, toda frame.
 */
export class GameLoop {
  readonly time: TimeInfo = { elapsed: 0, delta: 0, fps: 0, frame: 0 };

  /** escala global do tempo (0 = congelado) */
  timeScale = 1;

  onUpdate?: (dt: number) => void;
  onLateUpdate?: (dt: number) => void;
  onRender?: () => void;

  private rafId = 0;
  private lastTime = 0;
  private _running = false;
  private _paused = false;
  private fpsAccum = 0;
  private fpsFrames = 0;

  get paused(): boolean {
    return this._paused;
  }

  get running(): boolean {
    return this._running;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this._running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  pause(): void {
    this._paused = true;
  }

  resume(): void {
    if (!this._paused) return;
    this._paused = false;
    this.lastTime = performance.now(); // sem spike de delta
  }

  dispose(): void {
    this.stop();
    this.onUpdate = undefined;
    this.onLateUpdate = undefined;
    this.onRender = undefined;
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > MAX_DELTA) dt = MAX_DELTA;
    if (dt < 0) dt = 0;

    // FPS (atualiza 2x por segundo)
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.time.fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    // Pausado: mantém renderizando (cena congelada atrás do overlay)
    if (this._paused) {
      this.onRender?.();
      return;
    }

    const scaled = dt * this.timeScale;
    this.time.delta = scaled;
    this.time.elapsed += scaled;
    this.time.frame++;

    this.onUpdate?.(scaled);
    this.onLateUpdate?.(scaled);
    this.onRender?.();
  };
}
