import { useEffect, useRef, useState, useCallback } from 'react';
import {
  MatchStats,
  MatchPeriod,
  GameState,
  PlayerData,
  CameraMode,
  AIDifficulty,
  VirtualInput,
  TeamType,
} from './types/football';
import { FootballMatchEngine } from './game/matchEngine';
import { cameraController } from './game/cameraController';
import { soundManager } from './audio/soundManager';
import { ScoreboardHUD } from './components/ScoreboardHUD';
import { VirtualControls } from './components/VirtualControls';
import { GoalCelebrationOverlay } from './components/GoalCelebrationOverlay';
import { PauseMenu } from './components/PauseMenu';
import { PostMatchModal } from './components/PostMatchModal';
import { MainMenu } from './components/MainMenu';
import { ApkExportModal } from './components/ApkExportModal';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const matchEngineRef = useRef<FootballMatchEngine | null>(null);

  // React UI state
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [matchStats, setMatchStats] = useState<MatchStats>({
    score: { NEWGEN: 0, NEWEGOISTS: 0 },
    possession: { NEWGEN: 50, NEWEGOISTS: 50 },
    shots: { NEWGEN: 0, NEWEGOISTS: 0 },
    shotsOnTarget: { NEWGEN: 0, NEWEGOISTS: 0 },
    passes: { NEWGEN: 0, NEWEGOISTS: 0 },
    tackles: { NEWGEN: 0, NEWEGOISTS: 0 },
    goals: [],
  });
  const [matchMinutes, setMatchMinutes] = useState(0);
  const [matchSeconds, setMatchSeconds] = useState(0);
  const [period, setPeriod] = useState<MatchPeriod>('1ST_HALF');
  const [controlledPlayer, setControlledPlayer] = useState<PlayerData | undefined>(undefined);
  const [cameraMode, setCameraMode] = useState<CameraMode>('BROADCAST');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('SEMI_PRO');
  const [matchDuration, setMatchDuration] = useState(240);
  const [isMuted, setIsMuted] = useState(false);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [goalInfo, setGoalInfo] = useState<{ team: TeamType; scorer: string; minute: number } | null>(null);

  // Radar data
  const [radarPlayers, setRadarPlayers] = useState<PlayerData[]>([]);
  const [ballPos, setBallPos] = useState({ x: 0, z: 0 });

  // Initialize Game Scene once
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const engine = new FootballMatchEngine(canvasMountRef.current, {
      onScoreChange: (stats) => setMatchStats({ ...stats }),
      onTimeChange: (min, sec, per) => {
        setMatchMinutes(min);
        setMatchSeconds(sec);
        setPeriod(per);
      },
      onGameStateChange: (state, goal) => {
        setGameState(state);
        if (goal) {
          setGoalInfo(goal);
        } else {
          setGoalInfo(null);
        }
      },
      onControlledPlayerChange: (player) => setControlledPlayer({ ...player }),
    });

    matchEngineRef.current = engine;
    setControlledPlayer(engine.getControlledPlayer());

    // Game loop with Three.js Software-WebGL check
    let frameId = 0;
    let lastTime = performance.now();

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    function afterDraw(cb: () => void) {
      const gl = engine.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let radarTickCount = 0;

    const tick = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      engine.update(delta);

      // Throttle radar React updates to ~10 fps for silky 60fps rendering
      radarTickCount++;
      if (radarTickCount % 6 === 0) {
        setBallPos({ x: engine.ball.state.x, z: engine.ball.state.z });
        setRadarPlayers(
          engine.players.map((p) => ({
            id: p.id,
            team: p.team,
            x: p.x,
            z: p.z,
          } as PlayerData))
        );
        const curControlled = engine.getControlledPlayer();
        if (curControlled) {
          setControlledPlayer({ ...curControlled });
        }
      }

      if (isSoftwareGl) {
        afterDraw(() => tick(performance.now()));
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (canvasMountRef.current && matchEngineRef.current) {
        matchEngineRef.current.resize(
          canvasMountRef.current.clientWidth,
          canvasMountRef.current.clientHeight
        );
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      engine.dispose();
    };
  }, []);

  // Controls Handlers
  const handleInputChange = useCallback((input: VirtualInput) => {
    matchEngineRef.current?.setInput(input);
  }, []);

  const handlePass = useCallback(() => {
    matchEngineRef.current?.executeUserPass();
  }, []);

  const handleShoot = useCallback((power: number) => {
    matchEngineRef.current?.executeUserShoot(power);
  }, []);

  const handleTackle = useCallback(() => {
    matchEngineRef.current?.executeUserTackle();
  }, []);

  const handleSwitchPlayer = useCallback(() => {
    matchEngineRef.current?.switchPlayerToClosestToBall();
  }, []);

  // Camera Mode cycling
  const handleCycleCamera = () => {
    const nextMode = cameraController.cycleMode();
    setCameraMode(nextMode);
  };

  const handleSelectCamera = (mode: CameraMode) => {
    cameraController.setMode(mode);
    setCameraMode(mode);
  };

  // Sound toggle
  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    soundManager.setMuted(newMuted);
  };

  // Pause
  const handlePause = () => {
    setIsPauseOpen(true);
    if (matchEngineRef.current) {
      matchEngineRef.current.gameState = 'PAUSED';
    }
  };

  const handleResume = () => {
    setIsPauseOpen(false);
    if (matchEngineRef.current) {
      matchEngineRef.current.gameState = 'PLAYING';
    }
  };

  // Match Restart
  const handleRestart = () => {
    setIsPauseOpen(false);
    setGoalInfo(null);
    matchEngineRef.current?.restartMatch();
  };

  // Start match from main menu
  const handleStartMatch = (options: {
    difficulty: AIDifficulty;
    duration: number;
    camera: CameraMode;
  }) => {
    setDifficulty(options.difficulty);
    setMatchDuration(options.duration);
    setCameraMode(options.camera);
    cameraController.setMode(options.camera);

    if (matchEngineRef.current) {
      matchEngineRef.current.setDifficulty(options.difficulty);
      matchEngineRef.current.setMatchDuration(options.duration);
      matchEngineRef.current.restartMatch();
    }
    setGameState('PLAYING');
  };

  const isPossession = matchEngineRef.current
    ? Math.hypot(
        (controlledPlayer?.x || 0) - (matchEngineRef.current.ball.state.x || 0),
        (controlledPlayer?.z || 0) - (matchEngineRef.current.ball.state.z || 0)
      ) < 2.5
    : false;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none touch-none">
      {/* 1. 3D WebGL Canvas Viewport */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* 2. TV Broadcast Scoreboard & Radar HUD */}
      {gameState !== 'MENU' && (
        <ScoreboardHUD
          stats={matchStats}
          matchMinutes={matchMinutes}
          matchSeconds={matchSeconds}
          period={period}
          controlledPlayer={controlledPlayer}
          cameraMode={cameraMode}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onCycleCamera={handleCycleCamera}
          onPause={handlePause}
          onOpenApkInfo={() => setIsApkModalOpen(true)}
          players={radarPlayers}
          ballPos={ballPos}
        />
      )}

      {/* 3. Android Virtual Touchscreen Controls */}
      {gameState === 'PLAYING' && !isPauseOpen && (
        <VirtualControls
          onInputChange={handleInputChange}
          onPass={handlePass}
          onShoot={handleShoot}
          onTackle={handleTackle}
          onSwitchPlayer={handleSwitchPlayer}
          isPossession={isPossession}
        />
      )}

      {/* 4. Goal Celebration Fanfare Banner */}
      <GoalCelebrationOverlay goalInfo={goalInfo} />

      {/* 5. Pause Menu */}
      <PauseMenu
        isOpen={isPauseOpen}
        onResume={handleResume}
        onRestart={handleRestart}
        cameraMode={cameraMode}
        onSelectCamera={handleSelectCamera}
        difficulty={difficulty}
        onSelectDifficulty={(d) => {
          setDifficulty(d);
          matchEngineRef.current?.setDifficulty(d);
        }}
        matchDuration={matchDuration}
        onSelectMatchDuration={(dur) => {
          setMatchDuration(dur);
          matchEngineRef.current?.setMatchDuration(dur);
        }}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* 6. Post-Match Full Time Results Modal */}
      <PostMatchModal
        isOpen={gameState === 'GAME_OVER'}
        stats={matchStats}
        onPlayAgain={handleRestart}
      />

      {/* 7. Main Menu / Kickoff Screen */}
      {gameState === 'MENU' && (
        <MainMenu
          onStartMatch={handleStartMatch}
          onOpenApkInfo={() => setIsApkModalOpen(true)}
        />
      )}

      {/* 8. Android APK & Mobile Info Modal */}
      <ApkExportModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />
    </main>
  );
}
