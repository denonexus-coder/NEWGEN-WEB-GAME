import { Gamepad2, PackageOpen } from 'lucide-react';
import type { GameEntry } from '../gameRegistry';
import { GameCard } from '../components/GameCard';

interface Props {
  games: GameEntry[];
  onPlay: (game: GameEntry) => void;
  onRemove: (game: GameEntry) => void;
  onImportClick: () => void;
  onGoLibrary: () => void;
}

export function HomeScreen({ games, onPlay, onRemove, onImportClick, onGoLibrary }: Props) {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0a192f] via-[#0d2140] to-[#1b1140] p-8 md:p-12">
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-44 w-44 rounded-full bg-violet-600/20 blur-3xl" />
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">NewGen</p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-5xl">LAUNCHER</h1>
        <p className="mt-3 max-w-lg text-sm text-slate-400 md:text-base">
          Carregue seus jogos e jogue direto — sem internet, sem enrolação. 100% offline dentro do APK.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onImportClick}
            className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-cyan-300"
          >
            + Importar jogo
          </button>
          <button
            onClick={onGoLibrary}
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
          >
            Biblioteca ({games.length})
          </button>
        </div>
      </section>

      {/* Jogos */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Seus jogos</h2>
        <span className="text-xs text-slate-500">{games.length} instalado(s)</span>
      </div>

      {games.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 px-6 py-14 text-center">
          <div className="rounded-2xl bg-white/5 p-4">
            <PackageOpen size={40} className="text-slate-500" />
          </div>
          <h3 className="mt-4 font-semibold text-slate-200">Nenhum jogo ainda</h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Importe um pacote de jogo (<code className="text-cyan-400">.js</code> +{' '}
            <code className="text-cyan-400">manifest.json</code>) ou adicione um em{' '}
            <code className="text-cyan-400">src/games/</code> para embuti-lo no app.
          </p>
          <button
            onClick={onImportClick}
            className="mt-5 flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-cyan-300"
          >
            <Gamepad2 size={16} /> Importar primeiro jogo
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((g) => (
            <GameCard key={g.id} game={g} onPlay={onPlay} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
