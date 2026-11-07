import { Play, Trash2 } from 'lucide-react';
import type { GameEntry } from '../gameRegistry';

interface Props {
  game: GameEntry;
  onPlay: (game: GameEntry) => void;
  onRemove?: (game: GameEntry) => void;
}

export function GameCard({ game, onPlay, onRemove }: Props) {
  return (
    <div className="group overflow-hidden rounded-xl border border-white/10 bg-[#0a192f] transition hover:border-cyan-400/40">
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#0f2744] via-[#123a5c] to-[#2a1a52]">
        {game.thumbnail ? (
          <img src={game.thumbnail} alt={game.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl font-black text-white/20">
            {game.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${
            game.source === 'local' ? 'bg-violet-500 text-white' : 'bg-cyan-400 text-black'
          }`}
        >
          {game.source === 'local' ? 'LOCAL' : 'INTERNO'}
        </span>
      </div>

      <div className="p-3">
        <h3 className="truncate font-semibold text-slate-100" title={game.name}>
          {game.name}
        </h3>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {game.author || 'Desconhecido'}
          {game.version ? ` · v${game.version}` : ''}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => onPlay(game)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-black transition hover:bg-cyan-300"
          >
            <Play size={14} fill="black" /> Jogar
          </button>
          {onRemove && game.source === 'local' && (
            <button
              onClick={() => onRemove(game)}
              title="Remover jogo"
              className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
