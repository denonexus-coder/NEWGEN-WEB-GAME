import React, { useState } from 'react';
import { AIDifficulty, CameraMode } from '../types/football';
import { NEWGEN_ROSTER, NEWEGOISTS_ROSTER } from '../game/teams';
import { Play, Shield, Flame, Smartphone, ChevronRight } from 'lucide-react';

interface MainMenuProps {
  onStartMatch: (options: { difficulty: AIDifficulty; duration: number; camera: CameraMode }) => void;
  onOpenApkInfo: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStartMatch, onOpenApkInfo }) => {
  const [difficulty, setDifficulty] = useState<AIDifficulty>('SEMI_PRO');
  const [duration, setDuration] = useState<number>(240); // 4 minutes
  const [camera, setCamera] = useState<CameraMode>('BROADCAST');
  const [selectedTab, setSelectedTab] = useState<'MATCH' | 'LINEUPS'>('MATCH');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-3 sm:p-6 overflow-y-auto">
      {/* Background stadium light aura */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-2xl bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-5 sm:p-8 shadow-2xl text-slate-100 backdrop-blur-xl flex flex-col my-auto">
        {/* Title & Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[11px] font-black tracking-widest uppercase mb-2">
            <Flame className="w-3.5 h-3.5 text-cyan-400" />
            3D FOOTBALL SIMULATION • BLUE LOCK EGOISTS
          </div>

          <h1 className="text-3xl sm:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-rose-400">
            NEWGEN NEWS EGOISTS
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md">
            11 vs 11 authentic 3D football match engine with physical ball dynamics, tactical team AI, and virtual Android touchscreen controls.
          </p>
        </div>

        {/* Tab Selector: Match Setup vs Team Lineups */}
        <div className="flex border-b border-slate-800 mb-5">
          <button
            onClick={() => setSelectedTab('MATCH')}
            className={`pb-2 px-4 text-xs font-black tracking-wider transition-colors border-b-2 ${
              selectedTab === 'MATCH'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            MATCH SETUP
          </button>
          <button
            onClick={() => setSelectedTab('LINEUPS')}
            className={`pb-2 px-4 text-xs font-black tracking-wider transition-colors border-b-2 ${
              selectedTab === 'LINEUPS'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            TEAM LINEUPS (11v11)
          </button>
        </div>

        {/* TAB 1: MATCH SETUP */}
        {selectedTab === 'MATCH' && (
          <div className="space-y-4">
            {/* Team Clash Preview Card */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex flex-col items-center p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center font-black text-cyan-300 mb-1">
                  NG
                </div>
                <span className="font-black text-sm text-cyan-200 tracking-wider">NEWGEN</span>
                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">4-3-3 Attack</span>
                <span className="text-[10px] text-cyan-300 font-bold mt-1">Ace: Isagi (#9)</span>
              </div>

              <div className="flex flex-col items-center p-3 rounded-xl bg-rose-950/40 border border-rose-500/30">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center font-black text-rose-300 mb-1">
                  NE
                </div>
                <span className="font-black text-sm text-rose-200 tracking-wider">NEWEGOISTS</span>
                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">4-4-2 Balanced</span>
                <span className="text-[10px] text-rose-300 font-bold mt-1">Ace: Rin Itoshi (#10)</span>
              </div>
            </div>

            {/* AI Opponent Difficulty */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase mb-1.5">
                <Shield className="w-4 h-4 text-cyan-400" />
                AI Opponent Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['BEGINNER', 'SEMI_PRO', 'EGOIST_LEGEND'] as AIDifficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`py-2 px-1 text-xs font-black rounded-xl border transition-all ${
                      difficulty === d
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d === 'EGOIST_LEGEND' ? 'EGOIST LEGEND' : d.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Match Duration & Camera */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase mb-1.5 block">
                  Match Duration
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { sec: 180, label: '3 Mins' },
                    { sec: 240, label: '4 Mins' },
                    { sec: 360, label: '6 Mins' },
                  ].map((opt) => (
                    <button
                      key={opt.sec}
                      onClick={() => setDuration(opt.sec)}
                      className={`py-2 text-[11px] font-black rounded-lg border transition-all ${
                        duration === opt.sec
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 uppercase mb-1.5 block">
                  Starting Camera
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['BROADCAST', 'ACTION', 'TACTICAL'] as CameraMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setCamera(m)}
                      className={`py-2 text-[11px] font-black rounded-lg border transition-all ${
                        camera === m
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ROSTERS */}
        {selectedTab === 'LINEUPS' && (
          <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            <div className="bg-slate-950/60 rounded-xl p-3 border border-cyan-500/30">
              <span className="text-xs font-black text-cyan-400 block mb-2 border-b border-cyan-500/30 pb-1">
                NEWGEN (Blue Kits)
              </span>
              <div className="space-y-1 text-[11px]">
                {NEWGEN_ROSTER.map((p) => (
                  <div key={p.id} className="flex justify-between text-slate-300">
                    <span>#{p.number} {p.name}</span>
                    <span className="text-cyan-400 font-bold">{p.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-rose-500/30">
              <span className="text-xs font-black text-rose-400 block mb-2 border-b border-rose-500/30 pb-1">
                NEWEGOISTS (Red Kits)
              </span>
              <div className="space-y-1 text-[11px]">
                {NEWEGOISTS_ROSTER.map((p) => (
                  <div key={p.id} className="flex justify-between text-slate-300">
                    <span>#{p.number} {p.name}</span>
                    <span className="text-rose-400 font-bold">{p.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => onStartMatch({ difficulty, duration, camera })}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm tracking-widest shadow-xl shadow-cyan-900/50 flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Play className="w-5 h-5 fill-white" />
            KICK OFF MATCH
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>

          <button
            onClick={onOpenApkInfo}
            className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            ANDROID APK / PWA
          </button>
        </div>
      </div>
    </div>
  );
};
