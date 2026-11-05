import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VirtualInput } from '../types/football';
import { Zap, Target, ArrowRightLeft, ShieldAlert } from 'lucide-react';

interface VirtualControlsProps {
  onInputChange: (input: VirtualInput) => void;
  onPass: () => void;
  onShoot: (power: number) => void;
  onTackle: () => void;
  onSwitchPlayer: () => void;
  isPossession: boolean;
}

export const VirtualControls: React.FC<VirtualControlsProps> = ({
  onInputChange,
  onPass,
  onShoot,
  onTackle,
  onSwitchPlayer,
  isPossession,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const joystickPointerId = useRef<number | null>(null);

  const [isSprinting, setIsSprinting] = useState(false);
  const [isChargingShot, setIsChargingShot] = useState(false);
  const [shotPower, setShotPower] = useState(0);
  const shotChargeInterval = useRef<number | null>(null);

  // Vibration feedback helper
  const triggerHaptic = (ms: number = 20) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore
      }
    }
  };

  // Joystick touch handlers
  const handleJoystickStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    joystickPointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsJoystickActive(true);
    triggerHaptic(15);
  };

  const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isJoystickActive || joystickPointerId.current !== e.pointerId || !joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rawDx = e.clientX - centerX;
    const rawDy = e.clientY - centerY;
    const dist = Math.hypot(rawDx, rawDy);
    const maxRadius = 55;

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(rawDy, rawDx);

    const clampedX = Math.cos(angle) * clampedDist;
    const clampedY = Math.sin(angle) * clampedDist;

    setJoystickPos({ x: clampedX, y: clampedY });

    // In Three.js:
    // Field length is along X (screen horizontal)
    // Field width is along Z (screen vertical)
    const normX = clampedX / maxRadius;
    const normY = clampedY / maxRadius;

    onInputChange({
      joystick: {
        x: normX,
        y: normY,
        active: true,
        distance: clampedDist / maxRadius,
      },
      pass: false,
      shoot: isChargingShot,
      shootPower: shotPower,
      sprint: isSprinting,
      switchPlayer: false,
      tackle: false,
    });
  };

  const handleJoystickEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current === e.pointerId) {
      joystickPointerId.current = null;
      setIsJoystickActive(false);
      setJoystickPos({ x: 0, y: 0 });

      onInputChange({
        joystick: { x: 0, y: 0, active: false, distance: 0 },
        pass: false,
        shoot: isChargingShot,
        shootPower: shotPower,
        sprint: isSprinting,
        switchPlayer: false,
        tackle: false,
      });
    }
  };

  // Shot charging logic
  const handleShootDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    triggerHaptic(25);
    setIsChargingShot(true);
    setShotPower(0.2);

    let current = 0.2;
    shotChargeInterval.current = window.setInterval(() => {
      current = Math.min(1.0, current + 0.08);
      setShotPower(current);
    }, 40);
  };

  const handleShootUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (shotChargeInterval.current) {
      clearInterval(shotChargeInterval.current);
      shotChargeInterval.current = null;
    }
    const finalPower = shotPower;
    setIsChargingShot(false);
    triggerHaptic(40);
    onShoot(finalPower);
    setShotPower(0);
  };

  // Sprint Toggle
  const handleSprintDown = () => {
    triggerHaptic(20);
    setIsSprinting(true);
  };

  const handleSprintUp = () => {
    setIsSprinting(false);
  };

  // Keyboard controls for desktop fallback
  const keysDown = useRef<Set<string>>(new Set());

  const updateKeyboardInput = useCallback(() => {
    let kx = 0;
    let ky = 0;
    if (keysDown.current.has('KeyD') || keysDown.current.has('ArrowRight')) kx += 1;
    if (keysDown.current.has('KeyA') || keysDown.current.has('ArrowLeft')) kx -= 1;
    if (keysDown.current.has('KeyS') || keysDown.current.has('ArrowDown')) ky += 1;
    if (keysDown.current.has('KeyW') || keysDown.current.has('ArrowUp')) ky -= 1;

    const sprint = keysDown.current.has('ShiftLeft') || keysDown.current.has('ShiftRight') || keysDown.current.has('KeyL');
    setIsSprinting(sprint);

    const len = Math.hypot(kx, ky);
    if (len > 0) {
      kx /= len;
      ky /= len;
    }

    onInputChange({
      joystick: {
        x: kx,
        y: ky,
        active: len > 0,
        distance: len,
      },
      pass: false,
      shoot: isChargingShot,
      shootPower: shotPower,
      sprint,
      switchPlayer: false,
      tackle: false,
    });
  }, [isChargingShot, onInputChange, shotPower]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      keysDown.current.add(e.code);

      if (e.code === 'KeyX' || e.code === 'KeyJ') {
        onPass();
        triggerHaptic(20);
      } else if (e.code === 'Space' || e.code === 'KeyK') {
        if (!isChargingShot) {
          setIsChargingShot(true);
          setShotPower(0.3);
          shotChargeInterval.current = window.setInterval(() => {
            setShotPower((prev) => Math.min(1.0, prev + 0.1));
          }, 50);
        }
      } else if (e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'KeyC') {
        if (isPossession) {
          onSwitchPlayer();
        } else {
          onTackle();
        }
      }
      updateKeyboardInput();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.code);
      if (e.code === 'Space' || e.code === 'KeyK') {
        if (shotChargeInterval.current) {
          clearInterval(shotChargeInterval.current);
          shotChargeInterval.current = null;
        }
        setIsChargingShot(false);
        onShoot(shotPower || 0.6);
        setShotPower(0);
      }
      updateKeyboardInput();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isChargingShot, isPossession, onPass, onShoot, onSwitchPlayer, onTackle, shotPower, updateKeyboardInput]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20">
      {/* Power Charge Bar indicator above center */}
      {isChargingShot && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center">
          <div className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-1 drop-shadow-md">
            Shot Power
          </div>
          <div className="w-44 h-3.5 bg-black/60 rounded-full border border-amber-400/80 p-0.5 overflow-hidden shadow-lg backdrop-blur-sm">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${shotPower * 100}%`,
                background: shotPower > 0.85
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : 'linear-gradient(90deg, #10b981, #f59e0b)',
              }}
            />
          </div>
        </div>
      )}

      {/* LEFT SIDE: VIRTUAL JOYSTICK */}
      <div className="absolute left-4 sm:left-10 bottom-6 sm:bottom-12 pointer-events-auto">
        <div
          ref={joystickBaseRef}
          onPointerDown={handleJoystickStart}
          onPointerMove={handleJoystickMove}
          onPointerUp={handleJoystickEnd}
          onPointerCancel={handleJoystickEnd}
          className="relative w-36 h-36 rounded-full bg-slate-950/60 border-2 border-cyan-400/40 shadow-2xl flex items-center justify-center backdrop-blur-md active:border-cyan-400/90 transition-colors"
          style={{ touchAction: 'none' }}
        >
          {/* Subtle crosshair guides */}
          <div className="absolute w-full h-[1px] bg-cyan-400/20" />
          <div className="absolute h-full w-[1px] bg-cyan-400/20" />
          <div className="absolute w-20 h-20 rounded-full border border-cyan-400/20" />

          {/* Interactive Thumb Stick */}
          <div
            className={`w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-600 to-sky-400 shadow-lg border-2 border-white/80 flex items-center justify-center transition-transform ${
              isJoystickActive ? 'scale-105 shadow-cyan-500/50' : ''
            }`}
            style={{
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              transition: isJoystickActive ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            <div className="w-5 h-5 rounded-full bg-white/40" />
          </div>
        </div>
        <div className="text-center text-[10px] tracking-widest text-cyan-400/60 uppercase font-semibold mt-1">
          MOVE / STEER
        </div>
      </div>

      {/* RIGHT SIDE: ACTION BUTTONS DIAMOND */}
      <div className="absolute right-4 sm:right-8 bottom-6 sm:bottom-10 pointer-events-auto">
        <div className="relative w-48 h-48 sm:w-56 sm:h-56">
          {/* SHOOT BUTTON (Top) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <button
              onPointerDown={handleShootDown}
              onPointerUp={handleShootUp}
              onPointerCancel={handleShootUp}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-br from-rose-500 to-red-700 active:from-rose-400 active:to-red-600 border-2 border-red-300 text-white font-black text-sm tracking-wider shadow-xl shadow-red-950/60 flex flex-col items-center justify-center active:scale-95 transition-transform"
              style={{ touchAction: 'none' }}
            >
              <Target className="w-5 h-5 mb-0.5" />
              <span>SHOOT</span>
            </button>
            <span className="text-[9px] text-red-300/80 font-bold uppercase mt-0.5">SPACE / K</span>
          </div>

          {/* PASS BUTTON (Bottom) */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerHaptic(20);
                onPass();
              }}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 active:from-cyan-400 active:to-blue-600 border-2 border-cyan-200 text-white font-black text-sm tracking-wider shadow-xl shadow-blue-950/60 flex flex-col items-center justify-center active:scale-95 transition-transform"
              style={{ touchAction: 'none' }}
            >
              <ArrowRightLeft className="w-5 h-5 mb-0.5" />
              <span>PASS</span>
            </button>
            <span className="text-[9px] text-cyan-300/80 font-bold uppercase mt-0.5">X / J</span>
          </div>

          {/* SPRINT BUTTON (Right) */}
          <div className="absolute top-1/2 right-0 -translate-y-1/2 flex flex-col items-center">
            <button
              onPointerDown={handleSprintDown}
              onPointerUp={handleSprintUp}
              onPointerCancel={handleSprintUp}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 text-white font-black text-xs tracking-wider shadow-xl flex flex-col items-center justify-center active:scale-95 transition-all ${
                isSprinting
                  ? 'bg-amber-500 border-yellow-200 shadow-amber-500/50 scale-105'
                  : 'bg-gradient-to-br from-amber-600 to-yellow-700 border-amber-300/80 shadow-amber-950/60'
              }`}
              style={{ touchAction: 'none' }}
            >
              <Zap className="w-5 h-5" />
              <span>DASH</span>
            </button>
            <span className="text-[9px] text-amber-300/80 font-bold uppercase mt-0.5">SHIFT</span>
          </div>

          {/* SWITCH / TACKLE BUTTON (Left) */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 flex flex-col items-center">
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerHaptic(20);
                if (isPossession) {
                  onSwitchPlayer();
                } else {
                  onTackle();
                }
              }}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-800 active:from-indigo-500 active:to-purple-700 border-2 border-indigo-300 text-white font-black text-xs tracking-wider shadow-xl shadow-indigo-950/60 flex flex-col items-center justify-center active:scale-95 transition-transform"
              style={{ touchAction: 'none' }}
            >
              {isPossession ? (
                <>
                  <ArrowRightLeft className="w-4 h-4 mb-0.5" />
                  <span>SWITCH</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 mb-0.5" />
                  <span>SLIDE</span>
                </>
              )}
            </button>
            <span className="text-[9px] text-indigo-300/80 font-bold uppercase mt-0.5">Q / C</span>
          </div>
        </div>
      </div>
    </div>
  );
};
