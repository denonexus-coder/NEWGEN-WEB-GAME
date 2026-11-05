import React from 'react';
import { CameraMode, AIDifficulty } from '../types/football';
import { Play, RotateCcw, Volume2, Shield, Camera, X } from 'lucide-react';

interface PauseMenuProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  cameraMode: CameraMode;
  onSelectCamera: (mode: CameraMode) => void;
  difficulty: AIDifficulty;
  onSelectDifficulty: (diff: AIDifficulty) => void;
  matchDuration: number;
  onSelectMatchDuration: (sec: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  isOpen,
  onResume,
  onRestart,
  cameraMode,
  onSelectCamera,
  difficulty,
  onSelectDifficulty,
  matchDuration,
  onSelectMatchDuration,
  isMuted,
  onToggleMute,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-xl font-black tracking-wider text-white">MATCH PAUSED</h2>
          </div>
          <button
            onClick={onResume}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-4">
          {/* AI Difficulty */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase mb-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>AI Opponent Difficulty</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['BEGINNER', 'SEMI_PRO', 'EGOIST_LEGEND'] as AIDifficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onSelectDifficulty(d)}
                  className={`py-2 px-1 text-[11px] font-black rounded-lg border transition-all ${
                    difficulty === d
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/30'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d === 'EGOIST_LEGEND' ? 'LEGEND' : d.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Mode */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase mb-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>Camera Perspective</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['BROADCAST', 'ACTION', 'TACTICAL'] as CameraMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onSelectCamera(m)}
                  className={`py-2 px-1 text-[11px] font-black rounded-lg border transition-all ${
                    cameraMode === m
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/30'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Match Duration */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase mb-2 block">
              Match Duration (Real Time)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { sec: 180, label: '3 Mins' },
                { sec: 240, label: '4 Mins' },
                { sec: 360, label: '6 Mins' },
              ].map((opt) => (
                <button
                  key={opt.sec}
                  onClick={() => onSelectMatchDuration(opt.sec)}
                  className={`py-2 text-[11px] font-black rounded-lg border transition-all ${
                    matchDuration === opt.sec
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/30'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Sound */}
          <div className="flex items-center justify-between py-2 border-t border-slate-800">
            <span className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              Stadium & Commentary Audio
            </span>
            <button
              onClick={onToggleMute}
              className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                isMuted
                  ? 'bg-red-500/20 border-red-500 text-red-300'
                  : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
              }`}
            >
              {isMuted ? 'Muted' : 'Enabled'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={onResume}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm tracking-wider shadow-lg shadow-cyan-900/50 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-white" />
            RESUME MATCH
          </button>
          <button
            onClick={onRestart}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm tracking-wider border border-slate-700 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            RESTART
          </button>
        </div>
      </div>
    </div>
  );
};
