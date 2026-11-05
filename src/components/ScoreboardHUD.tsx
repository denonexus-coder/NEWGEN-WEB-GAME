import React from 'react';
import { MatchStats, MatchPeriod, PlayerData, CameraMode } from '../types/football';
import { Camera, Pause, Volume2, VolumeX, Smartphone } from 'lucide-react';

interface ScoreboardHUDProps {
  stats: MatchStats;
  matchMinutes: number;
  matchSeconds: number;
  period: MatchPeriod;
  controlledPlayer?: PlayerData;
  cameraMode: CameraMode;
  isMuted: boolean;
  onToggleMute: () => void;
  onCycleCamera: () => void;
  onPause: () => void;
  onOpenApkInfo: () => void;
  players: PlayerData[];
  ballPos: { x: number; z: number };
}

export const ScoreboardHUD: React.FC<ScoreboardHUDProps> = ({
  stats,
  matchMinutes,
  matchSeconds,
  period,
  controlledPlayer,
  cameraMode,
  isMuted,
  onToggleMute,
  onCycleCamera,
  onPause,
  onOpenApkInfo,
  players,
  ballPos,
}) => {
  const pad = (n: number) => n.toString().padStart(2, '0');

  // Convert field coordinates (-50..50, -32..32) to minimap percentage (0..100)
  const toMinimap = (x: number, z: number) => {
    const px = ((x + 50) / 100) * 100;
    const pz = ((z + 32) / 64) * 100;
    return { left: `${Math.max(2, Math.min(98, px))}%`, top: `${Math.max(4, Math.min(96, pz))}%` };
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-3 sm:p-5">
      {/* TOP BAR: SCOREBOARD + ACTIONS */}
      <div className="flex items-start justify-between w-full">
        {/* TV Style Cyber Scoreboard */}
        <div className="flex items-center bg-slate-950/85 border border-cyan-500/40 rounded-xl overflow-hidden shadow-2xl shadow-cyan-950/40 backdrop-blur-md pointer-events-auto">
          {/* Match Clock & Period */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 px-3 py-1.5 border-r border-cyan-500/30">
            <span className="text-[10px] font-black text-cyan-400 tracking-wider">
              {period === '1ST_HALF' ? '1ST' : period === '2ND_HALF' ? '2ND' : 'FT'}
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-white tracking-tight">
              {pad(matchMinutes)}:{pad(matchSeconds)}
            </span>
          </div>

          {/* NEWGEN TEAM */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
            <span className="font-black text-xs sm:text-sm text-cyan-100 tracking-wider">
              NEWGEN
            </span>
            <span className="text-xl sm:text-2xl font-black text-white px-1">
              {stats.score.NEWGEN}
            </span>
          </div>

          <div className="text-xs font-black text-slate-500 px-1">-</div>

          {/* NEWEGOISTS TEAM */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="text-xl sm:text-2xl font-black text-white px-1">
              {stats.score.NEWEGOISTS}
            </span>
            <span className="font-black text-xs sm:text-sm text-rose-300 tracking-wider">
              NEWEGOISTS
            </span>
            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
          </div>
        </div>

        {/* TOP RIGHT TOOLBAR */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* APK / Mobile Info */}
          <button
            onClick={onOpenApkInfo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-400/50 text-emerald-300 text-xs font-bold shadow-lg transition-colors"
            title="Android APK and Mobile Play Info"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">APK INFO</span>
          </button>

          {/* Camera View Switcher */}
          <button
            onClick={onCycleCamera}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-bold shadow-lg transition-colors"
            title={`Camera: ${cameraMode}`}
          >
            <Camera className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">{cameraMode}</span>
          </button>

          {/* Audio Mute/Unmute */}
          <button
            onClick={onToggleMute}
            className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 shadow-lg transition-colors"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Pause Menu Button */}
          <button
            onClick={onPause}
            className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 shadow-lg transition-colors"
            title="Pause Game"
          >
            <Pause className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* BOTTOM CENTER: MINIMAP RADAR & ACTIVE PLAYER STAMINA BADGE */}
      <div className="flex items-end justify-center w-full gap-4">
        {/* Active Player Card & Stamina */}
        {controlledPlayer && (
          <div className="hidden sm:flex flex-col bg-slate-950/80 border border-cyan-500/40 rounded-xl px-3 py-2 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-black text-cyan-300">
                #{controlledPlayer.number} {controlledPlayer.name.toUpperCase()}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                {controlledPlayer.role}
              </span>
            </div>
            {/* Stamina bar */}
            <div className="w-32 h-2 bg-slate-800 rounded-full mt-1 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-100"
                style={{ width: `${controlledPlayer.stamina}%` }}
              />
            </div>
          </div>
        )}

        {/* 2D PITCH MINIMAP RADAR */}
        <div className="relative w-40 h-24 sm:w-48 sm:h-28 bg-emerald-950/80 rounded-xl border border-emerald-500/40 shadow-2xl backdrop-blur-md overflow-hidden pointer-events-auto">
          {/* Halfway line */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-emerald-400/30" />
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-emerald-400/30" />
          {/* Penalty boxes */}
          <div className="absolute top-1/4 bottom-1/4 left-0 w-4 border-r border-t border-b border-emerald-400/30" />
          <div className="absolute top-1/4 bottom-1/4 right-0 w-4 border-l border-t border-b border-emerald-400/30" />

          {/* Players Dots */}
          {players.map((p) => {
            const pos = toMinimap(p.x, p.z);
            const isMe = controlledPlayer?.id === p.id;
            return (
              <div
                key={p.id}
                className={`absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform ${
                  isMe
                    ? 'bg-yellow-300 ring-2 ring-yellow-400 scale-125 z-10'
                    : p.team === 'NEWGEN'
                    ? 'bg-cyan-400 shadow-sm shadow-cyan-400'
                    : 'bg-rose-500 shadow-sm shadow-rose-500'
                }`}
                style={{ left: pos.left, top: pos.top }}
              />
            );
          })}

          {/* Ball Dot */}
          <div
            className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md shadow-white ring-1 ring-black z-20"
            style={toMinimap(ballPos.x, ballPos.z)}
          />
        </div>
      </div>
    </div>
  );
};
