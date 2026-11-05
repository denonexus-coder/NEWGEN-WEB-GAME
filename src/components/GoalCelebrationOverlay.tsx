import React from 'react';
import { TeamType } from '../types/football';

interface GoalCelebrationOverlayProps {
  goalInfo: {
    team: TeamType;
    scorer: string;
    minute: number;
  } | null;
}

export const GoalCelebrationOverlay: React.FC<GoalCelebrationOverlayProps> = ({ goalInfo }) => {
  if (!goalInfo) return null;

  const isNewgen = goalInfo.team === 'NEWGEN';

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center overflow-hidden">
      {/* Background radial flash */}
      <div
        className={`absolute inset-0 animate-pulse transition-opacity duration-300 ${
          isNewgen ? 'bg-cyan-500/20' : 'bg-rose-500/20'
        }`}
      />

      {/* Hero GOAL Banner */}
      <div className="relative flex flex-col items-center animate-bounce">
        {/* Glow backdrop */}
        <div
          className={`absolute -inset-10 blur-3xl opacity-70 ${
            isNewgen ? 'bg-cyan-500' : 'bg-rose-600'
          }`}
        />

        <div className="relative flex flex-col items-center bg-slate-950/90 border-2 border-white/80 rounded-3xl px-10 py-6 shadow-2xl backdrop-blur-xl">
          <span
            className={`text-6xl sm:text-8xl font-black italic tracking-tighter drop-shadow-lg ${
              isNewgen
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-blue-500'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-300 to-red-600'
            }`}
          >
            GOAL!
          </span>

          <div className="flex items-center gap-3 mt-2">
            <span
              className={`text-sm sm:text-lg font-black tracking-widest px-3 py-1 rounded-md ${
                isNewgen ? 'bg-cyan-600/50 text-cyan-200' : 'bg-rose-600/50 text-rose-200'
              }`}
            >
              {goalInfo.team}
            </span>
            <span className="text-xl sm:text-2xl font-black text-white">
              {goalInfo.scorer.toUpperCase()}
            </span>
          </div>

          <span className="text-xs font-bold text-slate-400 tracking-widest uppercase mt-2">
            {goalInfo.minute}&apos; MINUTE • CELEBRATION
          </span>
        </div>
      </div>
    </div>
  );
};
