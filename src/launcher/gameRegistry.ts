import type { GameModule } from '../engine/types';
import { deleteGame, getAllGames, getGame, putGame, type StoredGame } from './localGamesDB';

export type GameSource = 'builtin' | 'local';

export interface GameEntry {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  thumbnail?: string;
  source: GameSource;
  load: () => Promise<GameModule>;
}

/** Jogos embutidos no bundle (src/games/<id>/index.ts) — detectados automaticamente */
const builtinModules = import.meta.glob('../games/*/index.ts');

function metaFrom(g: Partial<GameModule>, id: string) {
  return {
    id: g.id || id,
    name: g.name || id,
    description: g.description,
    version: g.version,
    author: g.author,
    thumbnail: g.thumbnail,
  };
}

function isValidModule(g: unknown): g is GameModule {
  return !!g && typeof g === 'object' && typeof (g as GameModule).mount === 'function' && !!(g as GameModule).id;
}

export class GameRegistry {
  entries: GameEntry[] = [];

  /** varre jogos embutidos + jogos locais salvos no IndexedDB */
  async scan(): Promise<GameEntry[]> {
    const found: GameEntry[] = [];

    for (const [path, loader] of Object.entries(builtinModules)) {
      try {
        const mod = (await loader()) as { default?: unknown };
        if (!isValidModule(mod.default)) {
          console.warn(`[registry] ${path} sem GameModule válido (export default)`);
          continue;
        }
        const g = mod.default;
        found.push({
          ...metaFrom(g, path),
          source: 'builtin',
          // IMPORTANTE: import dinâmico devolve { default }, não o GameModule.
          // Normalizamos aqui para o contrato load(): Promise<GameModule>.
          load: async () => {
            const m = (await loader()) as { default?: unknown };
            if (!isValidModule(m.default)) throw new Error(`Jogo inválido: ${path}`);
            return m.default;
          },
        });
      } catch (err) {
        console.error(`[registry] falha ao carregar ${path}:`, err);
      }
    }

    try {
      const locals = await getAllGames();
      for (const rec of locals) {
        found.push({
          ...metaFrom(rec, rec.id),
          source: 'local',
          load: () => this.loadLocal(rec.id),
        });
      }
    } catch (err) {
      console.error('[registry] falha ao ler jogos locais:', err);
    }

    this.entries = found.sort((a, b) => a.name.localeCompare(b.name));
    return this.entries;
  }

  get(id: string): GameEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  /** importa um jogo local: seleciona .js (+ opcional manifest.json e imagem) */
  async importLocal(files: FileList | File[]): Promise<GameEntry> {
    const list = Array.from(files);
    const manifestFile = list.find((f) => f.name === 'manifest.json' || f.name === 'game.json');
    const jsFile = list.find((f) => f.name.endsWith('.js') || f.name.endsWith('.mjs'));
    if (!jsFile) throw new Error('Selecione o arquivo .js do jogo (e opcionalmente manifest.json + thumb)');

    let manifest: Partial<GameModule> = {};
    if (manifestFile) {
      try {
        manifest = JSON.parse(await manifestFile.text());
      } catch {
        throw new Error('manifest.json inválido');
      }
    }

    const thumbFile = list.find((f) => f.type.startsWith('image/'));
    const thumbnail = thumbFile ? await readAsDataURL(thumbFile) : manifest.thumbnail;

    const baseId = slug(manifest.id || jsFile.name.replace(/\.(js|mjs)$/, ''));
    const record: StoredGame = {
      id: baseId,
      name: manifest.name || prettify(baseId),
      description: manifest.description,
      version: manifest.version || '1.0.0',
      author: manifest.author,
      thumbnail,
      code: await jsFile.text(),
      savedAt: Date.now(),
    };

    await putGame(record);
    await this.scan();
    const entry = this.get(record.id);
    if (!entry) throw new Error('Jogo importado mas não registrado');
    return entry;
  }

  /** importa a partir de um .js único (atajo) */
  async importLocalJs(file: File): Promise<GameEntry> {
    return this.importLocal([file]);
  }

  async removeLocal(id: string): Promise<void> {
    await deleteGame(id);
    this.entries = this.entries.filter((e) => !(e.id === id && e.source === 'local'));
  }

  /** carrega o módulo de um jogo local do IndexedDB (blob URL → import dinâmico) */
  private async loadLocal(id: string): Promise<GameModule> {
    const rec = await getGame(id);
    if (!rec) throw new Error(`Jogo local "${id}" não encontrado`);
    const url = URL.createObjectURL(new Blob([rec.code], { type: 'text/javascript' }));
    try {
      const mod = (await import(/* @vite-ignore */ url)) as { default?: unknown };
      if (!isValidModule(mod.default)) throw new Error(`"${rec.name}" não exporta um GameModule válido`);
      return mod.default;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `game-${Date.now()}`
  );
}

function prettify(s: string): string {
  return s
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

export const registry = new GameRegistry();
