import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Pause, Play } from 'lucide-react';
import { createEngine } from '../engine';
import type { EngineHandle, EngineSettings, GameHandle } from '../engine/types';
import type { GameEntry } from './gameRegistry';

interface Props {
  entry: GameEntry;
  settings: EngineSettings;
  onExit: () => void;
}

type HostState = 'loading' | 'ready' | 'error';

/**
 * Sobe um jogo: cria a engine no canvas, monta o GameHandle e gerencia
 * resize, pause (ESC/botão), FPS e descarte seguro ao sair.
 */
export function GameHost({ entry, settings, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const handleRef = useRef<GameHandle | null>(null);

  const [state, setState] = useState<HostState>('loading');
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [fps, setFps] = useState(0);

  // boot da engine + jogo
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const boot = async () => {
      try {
        const engine = createEngine(canvas, { ...settings });
        engineRef.current = engine;
        engine.ctx.audio.unlock();

        const rect = container.getBoundingClientRect();
        engine.resize(rect.width, rect.height);

        resizeObserver = new ResizeObserver(() => {
          const r = container.getBoundingClientRect();
          engine.resize(r.width, r.height);
        });
        resizeObserver.observe(container);

        const mod = await entry.load();
        if (cancelled) {
          engine.dispose();
          return;
        }
        const handle = await mod.mount(engine.ctx);
        if (cancelled) {
          try {
            handle.dispose?.();
          } catch (err) {
            console.error('[GameHost] dispose:', err);
          }
          engine.dispose();
          return;
        }
        handleRef.current = handle;
        engine.setGame(handle);
        setState('ready');
      } catch (err) {
        console.error('[GameHost] falha ao iniciar:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setState('error');
        }
      }
    };
    void boot();

    const unlock = () => engineRef.current?.ctx.audio.unlock();
    window.addEventListener('pointerdown', unlock);

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', unlock);
      resizeObserver?.disconnect();
      const engine = engineRef.current;
      const handle = handleRef.current;
      engine?.setGame(null); // desacopla para não duplo-dispor
      try {
        handle?.dispose?.();
      } catch (err) {
        console.error('[GameHost] dispose:', err);
      }
      engine?.dispose();
      engineRef.current = null;
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || state !== 'ready') return;
    setPaused((p) => {
      const next = !p;
      if (next) {
        engine.ctx.loop.pause();
        handleRef.current?.pause?.();
      } else {
        handleRef.current?.resume?.();
        engine.ctx.loop.resume();
      }
      return next;
    });
  }, [state]);

  // ESC alterna pausa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause]);

  // contador de FPS
  useEffect(() => {
    if (!settings.showFps || state !== 'ready') return;
    const t = window.setInterval(() => setFps(engineRef.current?.ctx.time.fps ?? 0), 500);
    return () => window.clearInterval(t);
  }, [settings.showFps, state]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {state === 'ready' && settings.showFps && fps > 0 && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md bg-black/60 px-2 py-1 font-mono text-xs text-green-400">
          {fps} FPS
        </div>
      )}

      {state === 'ready' && !paused && (
        <button
          onClick={togglePause}
          className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-black/70"
        >
          <Pause size={15} /> Pausar
        </button>
      )}

      {state === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
          <p className="text-sm text-slate-400">
            Carregando <span className="font-semibold text-white">{entry.name}</span>…
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center">
          <AlertTriangle size={42} className="text-red-400" />
          <h2 className="text-lg font-bold text-white">Não foi possível iniciar o jogo</h2>
          <p className="max-w-md break-words text-sm text-slate-400">{error}</p>
          <button
            onClick={onExit}
            className="mt-2 flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-cyan-300"
          >
            <ArrowLeft size={16} /> Voltar ao launcher
          </button>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="w-72 rounded-2xl border border-white/10 bg-[#0a192f] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/15">
              <Pause size={22} className="text-cyan-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Pausado</h2>
            <p className="mt-1 truncate text-sm text-slate-400">{entry.name}</p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={togglePause}
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-cyan-300"
              >
                <Play size={15} fill="black" /> Continuar
              </button>
              <button
                onClick={onExit}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
              >
                <ArrowLeft size={15} /> Sair para o launcher
              </button>
            </div>

            <p className="mt-4 text-[11px] text-slate-500">ESC também pausa</p>
          </div>
        </div>
      )}
    </div>
  );
}
