import { useCallback, useEffect, useRef, useState } from 'react';
import { Gamepad2, Home, Settings as SettingsIcon } from 'lucide-react';
import type { EngineSettings } from '../engine/types';
import { registry, type GameEntry } from './gameRegistry';
import { GameHost } from './GameHost';
import { HomeScreen } from './screens/HomeScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Screen = 'home' | 'library' | 'settings';

const SETTINGS_KEY = 'newgen.launcher.settings';

const DEFAULT_SETTINGS: EngineSettings = {
  quality: 'high',
  masterVolume: 1,
  musicVolume: 0.8,
  sfxVolume: 1,
  showFps: true,
};

function loadSettings(): EngineSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<EngineSettings>;
    return {
      quality: parsed.quality === 'low' || parsed.quality === 'medium' ? parsed.quality : 'high',
      masterVolume: clamp01(parsed.masterVolume, DEFAULT_SETTINGS.masterVolume),
      musicVolume: clamp01(parsed.musicVolume, DEFAULT_SETTINGS.musicVolume),
      sfxVolume: clamp01(parsed.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      showFps: typeof parsed.showFps === 'boolean' ? parsed.showFps : true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback;
}

const NAV: { id: Screen; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'library', label: 'Biblioteca', icon: Gamepad2 },
  { id: 'settings', label: 'Configurações', icon: SettingsIcon },
];

export default function LauncherApp() {
  const [settings, setSettings] = useState<EngineSettings>(loadSettings);
  const [screen, setScreen] = useState<Screen>('home');
  const [games, setGames] = useState<GameEntry[]>([]);
  const [playing, setPlaying] = useState<GameEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // varre jogos (embutidos + locais)
  useEffect(() => {
    registry
      .scan()
      .then(setGames)
      .catch((err) => {
        console.error('[launcher] scan falhou:', err);
        setNotice('Falha ao carregar a biblioteca de jogos.');
      });
  }, []);

  // persiste settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage cheio/bloqueado — segue com settings em memória */
    }
  }, [settings]);

  const refresh = useCallback(async () => {
    setGames(await registry.scan());
  }, []);

  const openImport = () => fileRef.current?.click();

  const handleImport = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      try {
        const entry = await registry.importLocal(files);
        await refresh();
        setNotice(`"${entry.name}" importado com sucesso!`);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Falha ao importar o jogo.');
      } finally {
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [refresh],
  );

  const handleRemove = useCallback(
    async (game: GameEntry) => {
      if (!confirm(`Remover "${game.name}" deste aparelho?`)) return;
      await registry.removeLocal(game.id);
      await refresh();
    },
    [refresh],
  );

  // some o aviso depois de um tempo
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // roda o jogo em tela cheia
  if (playing) {
    return <GameHost entry={playing} settings={settings} onExit={() => setPlaying(null)} />;
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#050b14] text-slate-200">
      {/* input de importação (offline: arquivos do próprio aparelho) */}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".js,.mjs,.json,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => void handleImport(e.target.files)}
      />

      {/* Sidebar */}
      <aside className="flex w-16 shrink-0 flex-col border-r border-white/5 bg-[#070f1c] md:w-56">
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-600 text-sm font-black text-black">
            NG
          </div>
          <span className="hidden text-sm font-black tracking-wider text-white md:block">NEWGEN</span>
        </div>

        <nav className="mt-2 flex flex-col gap-1 px-2">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = screen === id;
            return (
              <button
                key={id}
                onClick={() => setScreen(id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-cyan-400/15 text-cyan-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
                title={label}
              >
                <Icon size={18} />
                <span className="hidden md:block">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-4 py-4 text-[10px] leading-relaxed text-slate-600">
          <span className="hidden md:block">v1.0.0 · offline</span>
          <span className="md:hidden">v1.0</span>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="relative flex-1 overflow-y-auto">
        {screen === 'home' && (
          <HomeScreen
            games={games}
            onPlay={setPlaying}
            onRemove={handleRemove}
            onImportClick={openImport}
            onGoLibrary={() => setScreen('library')}
          />
        )}
        {screen === 'library' && (
          <LibraryScreen games={games} onPlay={setPlaying} onRemove={handleRemove} onImportClick={openImport} />
        )}
        {screen === 'settings' && (
          <SettingsScreen settings={settings} onChange={setSettings} gamesCount={games.length} />
        )}

        {/* toast de aviso */}
        {notice && (
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-white/10 bg-[#0a192f] px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-2xl">
            {notice}
          </div>
        )}
      </main>
    </div>
  );
}
