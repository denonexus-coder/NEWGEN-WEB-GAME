import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Cache central de assets: texturas, modelos glTF, imagens.
 * Compartilhado entre jogos (trocar de jogo não recarrega o que já existe).
 */
export class AssetManager {
  private textures = new Map<string, THREE.Texture>();
  private models = new Map<string, Promise<GLTF>>();
  private images = new Map<string, HTMLImageElement>();
  private texLoader = new THREE.TextureLoader();
  private gltfLoader = new GLTFLoader();
  private maxAnisotropy = 1;

  /** chamado pelo engine para sincronizar anisotropia com o dispositivo */
  setMaxAnisotropy(v: number): void {
    this.maxAnisotropy = v;
    for (const t of this.textures.values()) t.anisotropy = v;
  }

  /** carrega textura com cache (colorSpace sRGB por padrão) */
  texture(url: string, opts: { srgb?: boolean } = {}): Promise<THREE.Texture> {
    const cached = this.textures.get(url);
    if (cached) return Promise.resolve(cached);
    return new Promise<THREE.Texture>((resolve, reject) => {
      this.texLoader.load(
        url,
        (t) => {
          t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
          t.anisotropy = this.maxAnisotropy;
          t.needsUpdate = true;
          this.textures.set(url, t);
          resolve(t);
        },
        undefined,
        (err) => reject(new Error(`[assets] textura falhou: ${url} (${String(err)})`)),
      );
    });
  }

  /** carrega modelo glTF com cache */
  model(url: string): Promise<GLTF> {
    let p = this.models.get(url);
    if (!p) {
      p = new Promise<GLTF>((resolve, reject) => {
        this.gltfLoader.load(
          url,
          (gltf) => resolve(gltf),
          undefined,
          (err) => reject(new Error(`[assets] glTF falhou: ${url} (${String(err)})`)),
        );
      });
      this.models.set(url, p);
    }
    return p;
  }

  /** carrega imagem HTML (thumbnails, sprites) com cache */
  image(url: string): Promise<HTMLImageElement> {
    const cached = this.images.get(url);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(url, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`[assets] imagem falhou: ${url}`));
      img.src = url;
    });
  }

  /** libera tudo (chamado no dispose da engine) */
  dispose(): void {
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.models.clear();
    this.images.clear();
  }
}
