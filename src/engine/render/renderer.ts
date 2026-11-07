import * as THREE from 'three';
import type { QualityLevel } from '../types';

export interface RenderTarget {
  scene: THREE.Scene;
  camera: THREE.Camera;
}

/**
 * Módulo de render: WebGLRenderer com padrões realistas (SRGB + ACES + sombras)
 * e alvo automático (setTarget) para o loop renderizar sem o jogo precisar chamar.
 */
export interface RenderModule {
  readonly renderer: THREE.WebGLRenderer;
  readonly width: number;
  readonly height: number;
  readonly quality: QualityLevel;
  /** define cena/câmera que o loop vai renderizar */
  setTarget(scene: THREE.Scene, camera: THREE.Camera): void;
  clearTarget(): void;
  /** renderiza o alvo atual (ou cena/câmera explícitos) */
  render(scene?: THREE.Scene, camera?: THREE.Camera): void;
  resize(width: number, height: number): void;
  setQuality(quality: QualityLevel): void;
  setClear(color: THREE.ColorRepresentation): void;
  dispose(): void;
}

function pixelCapFor(quality: QualityLevel): number {
  if (quality === 'low') return 1;
  if (quality === 'medium') return 1.5;
  return 2;
}

export function createRenderModule(canvas: HTMLCanvasElement, quality: QualityLevel): RenderModule {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality !== 'low',
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let current = quality;
  let width = canvas.clientWidth || 1;
  let height = canvas.clientHeight || 1;
  let target: RenderTarget | null = null;

  const applyPixelRatio = () => {
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, pixelCapFor(current)));
    renderer.setSize(width, height, false);
  };
  applyPixelRatio();

  return {
    renderer,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get quality() {
      return current;
    },
    setTarget(scene, camera) {
      target = { scene, camera };
    },
    clearTarget() {
      target = null;
    },
    render(scene, camera) {
      const s = scene ?? target?.scene;
      const c = camera ?? target?.camera;
      if (s && c) renderer.render(s, c);
    },
    resize(w, h) {
      width = Math.max(1, Math.floor(w));
      height = Math.max(1, Math.floor(h));
      applyPixelRatio();
    },
    setQuality(q) {
      if (q === current) return;
      current = q;
      renderer.shadowMap.enabled = q !== 'low';
      renderer.shadowMap.needsUpdate = true;
      applyPixelRatio();
    },
    setClear(color) {
      renderer.setClearColor(color);
    },
    dispose() {
      target = null;
      renderer.dispose();
    },
  };
}
