import { Download } from 'lucide-react';
import type { GameEntry } from '../gameRegistry';
import { GameCard } from '../components/GameCard';

interface Props {
  games: GameEntry[];
  onPlay: (game: GameEntry) => void;
  onRemove: (game: GameEntry) => void;
  onImportClick: () => void;
}

export function LibraryScreen({ games, onPlay, onRemove, onImportClick }: Props) {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Biblioteca</h1>
          <p className="mt-1 text-sm text-slate-400">
            {games.length === 0
              ? 'Sua biblioteca está vazia'
              : `${games.length} jogo(s) · jogos locais ficam salvos offline no aparelho`}
          </p>
        </div>
        <button
          onClick={onImportClick}
          className="flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-cyan-300"
        >
          <Download size={16} /> Importar
        </button>
      </div>

      {games.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0a192f] p-10 text-center text-sm text-slate-500">
          Nada por aqui. Clique em <span className="font-semibold text-cyan-400">Importar</span> e escolha o
          arquivo <code className="text-slate-300">.js</code> do jogo (opcional:{' '}
          <code className="text-slate-300">manifest.json</code> + imagem de capa).
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((g) => (
            <GameCard key={g.id} game={g} onPlay={onPlay} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
