import * as THREE from 'three';
import {
  PlayerData,
  BallState,
  GameState,
  MatchPeriod,
  MatchStats,
  AIDifficulty,
  VirtualInput,
  TeamType,
} from '../types/football';
import { initializeTeam } from './teams';
import { createBall, BallMeshAndPhysics } from './ballPhysics';
import { createPlayerMesh, PlayerMeshInstance } from './playerMesh';
import { createFootballStadium, StadiumObjects } from './stadium';
import { aiController } from './aiController';
import { cameraController } from './cameraController';
import { soundManager } from '../audio/soundManager';

export interface MatchEngineCallbacks {
  onScoreChange: (stats: MatchStats) => void;
  onTimeChange: (minute: number, second: number, period: MatchPeriod) => void;
  onGameStateChange: (state: GameState, goalInfo?: { team: TeamType; scorer: string; minute: number }) => void;
  onControlledPlayerChange: (player: PlayerData) => void;
}

export class FootballMatchEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public stadium: StadiumObjects;
  public ball: BallMeshAndPhysics;
  public players: PlayerData[] = [];
  public playerMeshes: Map<number, PlayerMeshInstance> = new Map();

  public controlledPlayerId: number = 10; // Default: Isagi (#9)
  public gameState: GameState = 'PLAYING';
  public period: MatchPeriod = '1ST_HALF';
  public difficulty: AIDifficulty = 'SEMI_PRO';

  // Time & Match progress
  public matchMinutes: number = 0;
  public matchSeconds: number = 0;
  public matchLengthRealSeconds: number = 240; // 4 minutes real time = 90 game minutes
  private gameTimeAccumulator: number = 0;

  // Stats
  public stats: MatchStats = {
    score: { NEWGEN: 0, NEWEGOISTS: 0 },
    possession: { NEWGEN: 50, NEWEGOISTS: 50 },
    shots: { NEWGEN: 0, NEWEGOISTS: 0 },
    shotsOnTarget: { NEWGEN: 0, NEWEGOISTS: 0 },
    passes: { NEWGEN: 0, NEWEGOISTS: 0 },
    tackles: { NEWGEN: 0, NEWEGOISTS: 0 },
    goals: [],
  };

  private callbacks: MatchEngineCallbacks;
  private goalCelebrationTimer: number = 0;
  private newgenPossessionFrames: number = 0;
  private totalPossessionFrames: number = 0;
  private input: VirtualInput = {
    joystick: { x: 0, y: 0, active: false, distance: 0 },
    pass: false,
    shoot: false,
    shootPower: 0,
    sprint: false,
    switchPlayer: false,
    tackle: false,
  };

  constructor(
    container: HTMLDivElement,
    callbacks: MatchEngineCallbacks
  ) {
    this.callbacks = callbacks;

    // Detect software WebGL per Three.js directives
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 1. Scene & Sky Environment
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1220);
    this.scene.fog = new THREE.FogExp2(0x0a1220, 0.0075);

    // 2. Camera - robust viewport fallback for Android WebViews
    const vw = container.clientWidth || window.innerWidth || 800;
    const vh = container.clientHeight || window.innerHeight || 450;
    this.camera = new THREE.PerspectiveCamera(48, vw / vh, 0.5, 350);
    this.camera.position.set(0, 24, -42);

    // 3. Renderer - Robust mobile viewport fallback
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'mediump',
      stencil: false,
    });
    this.renderer.setSize(vw, vh);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;

    container.appendChild(this.renderer.domElement);

    // 4. Studio & Stadium Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x166534, 0.6);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(30, 45, -25);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 45;
    sunLight.shadow.camera.bottom = -45;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // 5. Construct Stadium
    this.stadium = createFootballStadium(this.renderer);
    this.scene.add(this.stadium.group);

    // 6. Construct Ball
    this.ball = createBall();
    this.scene.add(this.ball.group);

    // 7. Initialize 22 Players (11 vs 11)
    this.initPlayers();

    // 8. Start Whistle
    soundManager.playWhistle('short');

    // Notify initial state
    this.callbacks.onGameStateChange(this.gameState);
    const controlled = this.getControlledPlayer();
    if (controlled) {
      this.callbacks.onControlledPlayerChange(controlled);
    }
  }

  private initPlayers() {
    const newgenTeam = initializeTeam('NEWGEN');
    const egoistsTeam = initializeTeam('NEWEGOISTS');
    this.players = [...newgenTeam, ...egoistsTeam];

    this.players.forEach((p) => {
      const pMesh = createPlayerMesh(p);
      this.playerMeshes.set(p.id, pMesh);
      this.scene.add(pMesh.group);
    });
  }

  public getControlledPlayer(): PlayerData | undefined {
    return this.players.find((p) => p.id === this.controlledPlayerId);
  }

  public setControlledPlayer(playerId: number) {
    const p = this.players.find((item) => item.id === playerId && item.team === 'NEWGEN' && !item.isGoalkeeper);
    if (p) {
      this.controlledPlayerId = p.id;
      this.callbacks.onControlledPlayerChange(p);
    }
  }

  public switchPlayerToClosestToBall() {
    let closestDist = 9999;
    let closestPlayer: PlayerData | null = null;
    for (const p of this.players) {
      if (p.team === 'NEWGEN' && !p.isGoalkeeper && p.id !== this.controlledPlayerId) {
        const dist = Math.hypot(p.x - this.ball.state.x, p.z - this.ball.state.z);
        if (dist < closestDist) {
          closestDist = dist;
          closestPlayer = p;
        }
      }
    }

    if (closestPlayer) {
      const target: PlayerData = closestPlayer;
      this.setControlledPlayer(target.id);
    }
  }

  public setInput(input: VirtualInput) {
    this.input = input;

    // Handle single-action triggers like switch player
    if (input.switchPlayer) {
      this.switchPlayerToClosestToBall();
    }
  }

  public setDifficulty(diff: AIDifficulty) {
    this.difficulty = diff;
  }

  public setMatchDuration(seconds: number) {
    this.matchLengthRealSeconds = seconds;
  }

  public resetPositionsForKickoff(kickoffTeam: TeamType = 'NEWGEN') {
    this.players.forEach((p) => {
      p.x = p.basePosition.x;
      p.y = 0;
      p.z = p.basePosition.z;
      p.vx = 0;
      p.vz = 0;
      p.rotation = p.team === 'NEWGEN' ? Math.PI / 2 : -Math.PI / 2;
      p.state = 'idle';
    });

    // Place ball at center circle
    this.ball.reset(0, 0);

    // Position kickoff striker
    if (kickoffTeam === 'NEWGEN') {
      const isagi = this.players.find((p) => p.id === 10);
      if (isagi) {
        isagi.x = -0.5;
        isagi.z = 0;
        this.setControlledPlayer(isagi.id);
      }
    } else {
      const rin = this.players.find((p) => p.id === 21);
      if (rin) {
        rin.x = 0.5;
        rin.z = 0;
      }
    }

    soundManager.playWhistle('short');
  }

  public restartMatch() {
    this.stats = {
      score: { NEWGEN: 0, NEWEGOISTS: 0 },
      possession: { NEWGEN: 50, NEWEGOISTS: 50 },
      shots: { NEWGEN: 0, NEWEGOISTS: 0 },
      shotsOnTarget: { NEWGEN: 0, NEWEGOISTS: 0 },
      passes: { NEWGEN: 0, NEWEGOISTS: 0 },
      tackles: { NEWGEN: 0, NEWEGOISTS: 0 },
      goals: [],
    };
    this.matchMinutes = 0;
    this.matchSeconds = 0;
    this.period = '1ST_HALF';
    this.gameState = 'PLAYING';
    this.resetPositionsForKickoff('NEWGEN');
    this.callbacks.onScoreChange(this.stats);
    this.callbacks.onTimeChange(0, 0, this.period);
    this.callbacks.onGameStateChange(this.gameState);
  }

  // Handle User Pass
  public executeUserPass() {
    const controlled = this.getControlledPlayer();
    if (!controlled) return;

    const ballDist = Math.hypot(controlled.x - this.ball.state.x, controlled.z - this.ball.state.z);
    if (ballDist > 2.0) return; // not close enough to pass

    // Find best teammate in facing cone or ahead
    const teammates = this.players.filter(
      (p) => p.team === 'NEWGEN' && p.id !== controlled.id && !p.isGoalkeeper
    );

    let bestTeammate: PlayerData | null = null;
    let bestScore = -999;

    teammates.forEach((t) => {
      const dx = t.x - controlled.x;
      const dz = t.z - controlled.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 40) {
        // Forward bias (+X)
        const forwardScore = dx * 1.5;
        // Direction alignment with joystick or player rotation
        const passDir = Math.atan2(dx, dz);
        const angleDiff = Math.abs(passDir - controlled.rotation);
        const alignmentScore = Math.cos(angleDiff) * 20;

        const totalScore = forwardScore + alignmentScore - dist * 0.3;
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestTeammate = t;
        }
      }
    });

    if (bestTeammate) {
      controlled.state = 'kicking';
      const target: PlayerData = bestTeammate;
      const dx = target.x - this.ball.state.x;
      const dz = target.z - this.ball.state.z;
      const dist = Math.max(0.1, Math.hypot(dx, dz));
      const passSpeed = Math.min(26, Math.max(14, dist * 1.2));
      const nx = dx / dist;
      const nz = dz / dist;

      this.ball.kick(nx * passSpeed, 0.4, nz * passSpeed, 'NEWGEN', controlled.id);
      soundManager.playKick(0.7);

      this.stats.passes.NEWGEN++;
      this.callbacks.onScoreChange(this.stats);

      // Seamless switch to receiver
      setTimeout(() => {
        this.setControlledPlayer(target.id);
      }, 250);
    }
  }

  // Handle User Shoot
  public executeUserShoot(powerPercent: number = 0.8) {
    const controlled = this.getControlledPlayer();
    if (!controlled) return;

    const ballDist = Math.hypot(controlled.x - this.ball.state.x, controlled.z - this.ball.state.z);
    if (ballDist > 2.2) return;

    controlled.state = 'kicking';

    // Target the opponent goal mouth (X = 50, Z between -6 and +6)
    const goalTargetX = 50;
    // Aim towards goal with user joystick curve / direction control
    let aimZ = 0;
    if (this.input.joystick.active) {
      // joystick.y moves across field width (Z), joystick.x along length (X)
      aimZ = this.input.joystick.y * 9.0;
    } else {
      // Follow player facing direction
      aimZ = controlled.z + Math.cos(controlled.rotation) * 10.0;
    }
    // Add tiny skill variance based on shot power
    aimZ += (Math.random() - 0.5) * (1.5 * (1.0 - powerPercent));

    const dx = goalTargetX - this.ball.state.x;
    const dz = aimZ - this.ball.state.z;
    const dist = Math.max(0.1, Math.hypot(dx, dz));
    const shotPower = 22 + powerPercent * 18; // up to 40 m/s
    const loft = 2.0 + powerPercent * 5.0;
    const nx = dx / dist;
    const nz = dz / dist;

    this.ball.kick(nx * shotPower, loft, nz * shotPower, 'NEWGEN', controlled.id);

    if (powerPercent > 0.6) {
      soundManager.playPowerShot();
    } else {
      soundManager.playKick(0.8);
    }

    this.stats.shots.NEWGEN++;
    if (Math.abs(aimZ) < 6.5) {
      this.stats.shotsOnTarget.NEWGEN++;
    }
    this.callbacks.onScoreChange(this.stats);
  }

  // Handle User Slide Tackle
  public executeUserTackle() {
    const controlled = this.getControlledPlayer();
    if (!controlled) return;

    controlled.state = 'tackling';
    soundManager.playTackle();
    this.stats.tackles.NEWGEN++;

    // Check if near ball or opponent
    const ballDist = Math.hypot(controlled.x - this.ball.state.x, controlled.z - this.ball.state.z);
    if (ballDist < 2.2) {
      // Poke ball away forward
      this.ball.kick(14, 1.2, (Math.random() - 0.5) * 10, 'NEWGEN', controlled.id);
    }
  }

  public update(delta: number) {
    if (this.gameState === 'PAUSED') return;

    const dt = Math.min(delta, 0.05);

    // 1. Goal Celebration State
    if (this.gameState === 'GOAL_CELEBRATION') {
      this.goalCelebrationTimer -= dt;
      this.ball.update(dt);
      if (this.goalCelebrationTimer <= 0) {
        this.gameState = 'PLAYING';
        this.resetPositionsForKickoff(this.ball.state.lastTouchedByTeam === 'NEWGEN' ? 'NEWEGOISTS' : 'NEWGEN');
        this.callbacks.onGameStateChange(this.gameState);
      }
      this.render();
      return;
    }

    // 2. Match Clock progression (90 minutes total across 2 halves)
    this.gameTimeAccumulator += dt;
    const gameMinutesPerRealSecond = 90 / this.matchLengthRealSeconds;
    const addedMinutes = dt * gameMinutesPerRealSecond;
    this.matchMinutes += addedMinutes;
    this.matchSeconds = Math.floor((this.matchMinutes % 1) * 60);

    // Half Time check
    if (this.period === '1ST_HALF' && this.matchMinutes >= 45) {
      this.period = 'HALF_TIME';
      this.gameState = 'HALF_TIME_BREAK';
      soundManager.playWhistle('long');
      this.callbacks.onGameStateChange(this.gameState);
      this.callbacks.onTimeChange(45, 0, this.period);
      this.render();
      return;
    }

    // Full Time check
    if (this.period === '2ND_HALF' && this.matchMinutes >= 90) {
      this.period = 'FULL_TIME';
      this.gameState = 'GAME_OVER';
      soundManager.playWhistle('long');
      this.callbacks.onGameStateChange(this.gameState);
      this.callbacks.onTimeChange(90, 0, this.period);
      this.render();
      return;
    }

    this.callbacks.onTimeChange(Math.floor(this.matchMinutes), this.matchSeconds, this.period);

    // 3. Auto-Switch: When defending or ball is loose and far away, switch to nearest NEWGEN player
    if (!this.input.joystick.active && this.ball.state.lastTouchedByTeam !== 'NEWGEN') {
      const distToCurrControlled = controlled ? Math.hypot(controlled.x - this.ball.state.x, controlled.z - this.ball.state.z) : 999;
      if (distToCurrControlled > 12.0) {
        let bestCandidate: PlayerData | null = null;
        let bestDist = 999;
        this.players.forEach((p) => {
          if (p.team === 'NEWGEN' && !p.isGoalkeeper) {
            const d = Math.hypot(p.x - this.ball.state.x, p.z - this.ball.state.z);
            if (d < bestDist) {
              bestDist = d;
              bestCandidate = p;
            }
          }
        });
        if (bestCandidate && bestCandidate.id !== this.controlledPlayerId) {
          this.setControlledPlayer(bestCandidate.id);
        }
      }
    }

    // 3. Update User Controlled Player Movement
    const activeControlled = this.getControlledPlayer();
    if (activeControlled) {
      const joy = this.input.joystick;
      if (joy.active && (Math.abs(joy.x) > 0.05 || Math.abs(joy.y) > 0.05)) {
        const moveSpeed = this.input.sprint ? activeControlled.maxSpeed : activeControlled.speed;
        // In BROADCAST camera, joy.x = Screen Left/Right (Field X), joy.y = Screen Up/Down (Field Z)
        activeControlled.vx = joy.x * moveSpeed;
        activeControlled.vz = joy.y * moveSpeed;

        // Player faces movement direction correctly in 3D
        activeControlled.rotation = Math.atan2(joy.x, joy.y);
        activeControlled.state = this.input.sprint ? 'sprinting' : 'running';

        // Stamina consumption when sprinting
        if (this.input.sprint && activeControlled.stamina > 0) {
          activeControlled.stamina = Math.max(0, activeControlled.stamina - dt * 15);
        }
      } else {
        activeControlled.vx = 0;
        activeControlled.vz = 0;
        if (activeControlled.state !== 'kicking' && activeControlled.state !== 'tackling') {
          activeControlled.state = 'idle';
        }
        // Stamina recovery
        activeControlled.stamina = Math.min(100, activeControlled.stamina + dt * 12);
      }

      // Step controlled player position
      activeControlled.x += activeControlled.vx * dt;
      activeControlled.z += activeControlled.vz * dt;
      activeControlled.x = Math.max(-49, Math.min(49, activeControlled.x));
      activeControlled.z = Math.max(-31, Math.min(31, activeControlled.z));

      // Realistic Dribbling Physics: gentle physical impulse rather than rigid magnetic lock
      const distToBall = Math.hypot(activeControlled.x - this.ball.state.x, activeControlled.z - this.ball.state.z);
      if (distToBall < 1.35 && this.ball.state.y < 1.4 && activeControlled.state !== 'kicking') {
        const targetLeadDist = 0.95;
        const forwardX = Math.sin(activeControlled.rotation) * targetLeadDist;
        const forwardZ = Math.cos(activeControlled.rotation) * targetLeadDist;
        const targetBallX = activeControlled.x + forwardX;
        const targetBallZ = activeControlled.z + forwardZ;

        // Soft nudge with inertia
        const nudgeX = (targetBallX - this.ball.state.x) * 4.5;
        const nudgeZ = (targetBallZ - this.ball.state.z) * 4.5;
        this.ball.state.vx = this.ball.state.vx * 0.4 + (activeControlled.vx + nudgeX) * 0.6;
        this.ball.state.vz = this.ball.state.vz * 0.4 + (activeControlled.vz + nudgeZ) * 0.6;
        this.ball.state.lastTouchedByTeam = 'NEWGEN';
        this.ball.state.lastTouchedPlayerId = activeControlled.id;
      }
    }

    // 4. Update AI for all other 21 players
    aiController.update(
      dt,
      this.players,
      this.ball.state,
      this.controlledPlayerId,
      this.difficulty,
      (vx, vy, vz, team, playerId) => {
        this.ball.kick(vx, vy, vz, team, playerId);
      }
    );

    // 4.1 Player vs Player Physical Collision & Body Separation
    // Prevents players from merging/ghosting into each other
    const minSeparation = 1.1; // minimum physical collision distance (body capsule radius * 2)
    const pCount = this.players.length;
    for (let i = 0; i < pCount; i++) {
      const p1 = this.players[i];
      for (let j = i + 1; j < pCount; j++) {
        const p2 = this.players[j];
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.0001 && dist < minSeparation) {
          const overlap = 0.5 * (minSeparation - dist);
          const nx = dx / dist;
          const nz = dz / dist;
          // Push both players apart smoothly
          p1.x -= nx * overlap;
          p1.z -= nz * overlap;
          p2.x += nx * overlap;
          p2.z += nz * overlap;
        }
      }
    }

    // 5. Update Ball Physics & Goal / Boundary Detection
    const ballResult = this.ball.update(dt);

    // Possession tracking
    this.totalPossessionFrames++;
    if (this.ball.state.lastTouchedByTeam === 'NEWGEN') {
      this.newgenPossessionFrames++;
    }
    const newgenPct = Math.round((this.newgenPossessionFrames / this.totalPossessionFrames) * 100);
    this.stats.possession.NEWGEN = Math.max(20, Math.min(80, newgenPct));
    this.stats.possession.NEWEGOISTS = 100 - this.stats.possession.NEWGEN;

    // GOAL CHECK
    if (ballResult.goalScored) {
      const scoringTeam = ballResult.goalScored;
      this.stats.score[scoringTeam]++;

      const scorerId = this.ball.state.lastTouchedPlayerId;
      const scorer = this.players.find((p) => p.id === scorerId) || {
        name: scoringTeam === 'NEWGEN' ? 'Isagi' : 'Rin',
        number: 9,
      };

      this.stats.goals.push({
        team: scoringTeam,
        scorerName: scorer.name,
        scorerNumber: scorer.number,
        minute: Math.max(1, Math.floor(this.matchMinutes)),
      });

      this.gameState = 'GOAL_CELEBRATION';
      this.goalCelebrationTimer = 3.5;
      this.callbacks.onScoreChange(this.stats);
      this.callbacks.onGameStateChange(this.gameState, {
        team: scoringTeam,
        scorer: scorer.name,
        minute: Math.max(1, Math.floor(this.matchMinutes)),
      });
    }
    // Out of bounds reset
    else if (ballResult.outOfBounds && this.gameState === 'PLAYING') {
      soundManager.playWhistle('short');
      // Place ball back inside touchline or corner
      const clampedX = Math.max(-46, Math.min(46, this.ball.state.x));
      const clampedZ = Math.max(-28, Math.min(28, this.ball.state.z));
      this.ball.reset(clampedX, clampedZ);
    }

    // 6. Update 3D Visual Meshes & Skeletal Animations
    this.players.forEach((p) => {
      const pMesh = this.playerMeshes.get(p.id);
      if (pMesh) {
        pMesh.updateAnimation(p, dt, p.id === this.controlledPlayerId);
      }
    });

    // 7. Update Dynamic Camera
    cameraController.update(this.camera, dt, controlled, this.ball.state);

    // 8. Render Frame
    this.render();
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public dispose() {
    this.renderer.dispose();
  }
}
