import React from 'react';
import { MatchStats } from '../types/football';
import { Trophy, RotateCcw } from 'lucide-react';

interface PostMatchModalProps {
  isOpen: boolean;
  stats: MatchStats;
  onPlayAgain: () => void;
}

export const PostMatchModal: React.FC<PostMatchModalProps> = ({
  isOpen,
  stats,
  onPlayAgain,
}) => {
  if (!isOpen) return null;

  const newgenScore = stats.score.NEWGEN;
  const egoistsScore = stats.score.NEWEGOISTS;

  const isWin = newgenScore > egoistsScore;
  const isDraw = newgenScore === egoistsScore;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 flex flex-col items-center">
        {/* Match Result Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center mb-3 text-cyan-300">
            <Trophy className="w-6 h-6" />
          </div>

          <span className="text-xs font-black tracking-widest text-cyan-400 uppercase">
            FULL TIME • EGOIST CUP
          </span>

          <h1
            className={`text-2xl sm:text-3xl font-black tracking-wider mt-1 ${
              isWin
                ? 'text-cyan-300 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]'
                : isDraw
                ? 'text-amber-300'
                : 'text-rose-400'
            }`}
          >
            {isWin ? 'NEWGEN VICTORY!' : isDraw ? 'DRAW MATCH' : 'NEWEGOISTS VICTORY'}
          </h1>
        </div>

        {/* Scoreboard Result Card */}
        <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-around mb-6 shadow-inner">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-cyan-400 tracking-wider">NEWGEN</span>
            <span className="text-4xl sm:text-5xl font-black text-white mt-1">{newgenScore}</span>
          </div>

          <span className="text-xl font-bold text-slate-600">VS</span>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-rose-400 tracking-wider">NEWEGOISTS</span>
            <span className="text-4xl sm:text-5xl font-black text-white mt-1">{egoistsScore}</span>
          </div>
        </div>

        {/* Match Stats Comparison */}
        <div className="w-full space-y-2.5 mb-6 text-xs font-medium">
          {/* Possession */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>{stats.possession.NEWGEN}%</span>
              <span className="text-slate-400 uppercase font-bold text-[10px]">Possession</span>
              <span>{stats.possession.NEWEGOISTS}%</span>
            </div>
            <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-800">
              <div
                className="bg-cyan-500 transition-all duration-300"
                style={{ width: `${stats.possession.NEWGEN}%` }}
              />
              <div
                className="bg-rose-500 transition-all duration-300"
                style={{ width: `${stats.possession.NEWEGOISTS}%` }}
              />
            </div>
          </div>

          {/* Total Shots */}
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="font-bold text-cyan-300">{stats.shots.NEWGEN}</span>
            <span className="text-slate-400 uppercase text-[10px]">Total Shots</span>
            <span className="font-bold text-rose-400">{stats.shots.NEWEGOISTS}</span>
          </div>

          {/* Shots on Target */}
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="font-bold text-cyan-300">{stats.shotsOnTarget.NEWGEN}</span>
            <span className="text-slate-400 uppercase text-[10px]">Shots on Target</span>
            <span className="font-bold text-rose-400">{stats.shotsOnTarget.NEWEGOISTS}</span>
          </div>

          {/* Passes */}
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="font-bold text-cyan-300">{stats.passes.NEWGEN}</span>
            <span className="text-slate-400 uppercase text-[10px]">Completed Passes</span>
            <span className="font-bold text-rose-400">{stats.passes.NEWEGOISTS}</span>
          </div>

          {/* Tackles */}
          <div className="flex justify-between items-center py-1">
            <span className="font-bold text-cyan-300">{stats.tackles.NEWGEN}</span>
            <span className="text-slate-400 uppercase text-[10px]">Tackles</span>
            <span className="font-bold text-rose-400">{stats.tackles.NEWEGOISTS}</span>
          </div>
        </div>

        {/* Goal Scorers list if any */}
        {stats.goals.length > 0 && (
          <div className="w-full bg-slate-950/50 rounded-xl p-3 mb-6 border border-slate-800/60 max-h-24 overflow-y-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Match Goals
            </span>
            <div className="space-y-1">
              {stats.goals.map((g, idx) => (
                <div key={idx} className="flex justify-between text-xs text-slate-200">
                  <span className={g.team === 'NEWGEN' ? 'text-cyan-300' : 'text-rose-400'}>
                    ⚽ {g.scorerName} (#{g.scorerNumber})
                  </span>
                  <span className="text-slate-400">{g.minute}&apos;</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Play Again Button */}
        <button
          onClick={onPlayAgain}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm tracking-widest shadow-xl shadow-cyan-900/50 flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <RotateCcw className="w-5 h-5" />
          PLAY ANOTHER MATCH
        </button>
      </div>
    </div>
  );
};
