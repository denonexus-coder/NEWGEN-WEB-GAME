import type * as THREE from 'three';
import type { GameLoop } from './core/loop';
import type { EventBus } from './core/events';
import type { InputManager } from './input/inputManager';
import type { AudioManager } from './audio/audioManager';
import type { AssetManager } from './assets/assetManager';
import type { RenderModule } from './render/renderer';
import type { PhysicsWorld } from './physics/physics';

/** Nível de qualidade gráfica (define pixel ratio, antialias, sombras) */
export type QualityLevel = 'low' | 'medium' | 'high';

/** Configurações do motor — salvas pelo launcher e passadas ao criar a engine */
export interface EngineSettings {
  quality: QualityLevel;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  showFps: boolean;
}

/** Informações de tempo do frame (atualizadas pelo game loop) */
export interface TimeInfo {
  /** segundos desde o start */
  elapsed: number;
  /** delta do frame atual (já aplicado timeScale, clamp 100ms) */
  delta: number;
  /** FPS suavizado */
  fps: number;
  /** número de frames renderizados */
  frame: number;
}

/**
 * Contexto entregue a cada jogo — única porta de acesso dele à engine.
 * Nenhum jogo importa módulos internos: tudo pasa por aqui.
 */
export interface EngineContext {
  readonly canvas: HTMLCanvasElement;
  /** Namespace THREE para jogos externos (via import dinâmico) */
  readonly THREE: typeof THREE;
  readonly render: RenderModule;
  readonly loop: GameLoop;
  readonly events: EventBus;
  readonly input: InputManager;
  readonly audio: AudioManager;
  readonly assets: AssetManager;
  readonly physics: PhysicsWorld;
  readonly time: TimeInfo;
  readonly settings: EngineSettings;
}

/** Handle retornado por GameModule.mount — callbacks chamados pelo loop */
export interface GameHandle {
  update?(dt: number): void;
  lateUpdate?(dt: number): void;
  resize?(width: number, height: number): void;
  pause?(): void;
  resume?(): void;
  dispose?(): void;
}

/** Contrato padrão de TODO jogo que roda no launcher */
export interface GameModule {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  /** url ou data-uri (opcional) */
  thumbnail?: string;
  mount(ctx: EngineContext): Promise<GameHandle> | GameHandle;
}

/** Resultado de createEngine */
export interface EngineHandle {
  readonly ctx: EngineContext;
  setGame(game: GameHandle | null): void;
  resize(width: number, height: number): void;
  setQuality(quality: QualityLevel): void;
  dispose(): void;
}
