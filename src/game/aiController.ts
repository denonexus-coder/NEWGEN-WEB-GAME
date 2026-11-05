import { PlayerData, BallState, AIDifficulty, TeamType } from '../types/football';
import { soundManager } from '../audio/soundManager';

export class FootballAIController {
  private difficultyMultipliers = {
    BEGINNER: { speed: 0.82, reaction: 0.65, shotAccuracy: 0.70, pressRange: 14, passSkill: 0.60 },
    SEMI_PRO: { speed: 0.96, reaction: 0.88, shotAccuracy: 0.86, pressRange: 19, passSkill: 0.82 },
    EGOIST_LEGEND: { speed: 1.08, reaction: 1.0, shotAccuracy: 0.96, pressRange: 26, passSkill: 0.95 },
  };

  public update(
    delta: number,
    players: PlayerData[],
    ball: BallState,
    controlledPlayerId: number,
    difficulty: AIDifficulty,
    onKickBall: (vx: number, vy: number, vz: number, team: TeamType, playerId: number) => void
  ) {
    const diff = this.difficultyMultipliers[difficulty];

    // Identify team possessing the ball
    const ballPossessionDist = 1.45;
    let ballPossessor: PlayerData | null = null;
    let closestNewgenDist = 9999;
    let closestNewgenPlayer: PlayerData | null = null;
    let closestEgoistDist = 9999;
    let closestEgoistPlayer: PlayerData | null = null;

    players.forEach((p) => {
      const dist = Math.hypot(p.x - ball.x, p.z - ball.z);
      if (dist < ballPossessionDist && ball.y < 1.6) {
        ballPossessor = p;
      }
      if (p.team === 'NEWGEN') {
        if (!p.isGoalkeeper && dist < closestNewgenDist) {
          closestNewgenDist = dist;
          closestNewgenPlayer = p;
        }
      } else {
        if (!p.isGoalkeeper && dist < closestEgoistDist) {
          closestEgoistDist = dist;
          closestEgoistPlayer = p;
        }
      }
    });

    const isTeamPossessing = (team: TeamType) => {
      if (ballPossessor && ballPossessor.team === team) return true;
      return ball.lastTouchedByTeam === team;
    };

    players.forEach((player) => {
      player.animTime += delta;

      // 1. Specialized Goalkeeper AI
      if (player.isGoalkeeper) {
        this.updateGoalkeeper(player, ball, delta, onKickBall);
        return;
      }

      // If user is controlling this player, let user input guide them
      if (player.id === controlledPlayerId) {
        return;
      }

      const isAI = player.team === 'NEWEGOISTS';
      const myTeam = player.team;
      const oppTeam: TeamType = myTeam === 'NEWGEN' ? 'NEWEGOISTS' : 'NEWGEN';
      const attackingGoalX = myTeam === 'NEWGEN' ? 50 : -50;
      const defendingGoalX = myTeam === 'NEWGEN' ? -50 : 50;

      // Dynamic Formation & Shift: players dynamically advance and track ball
      const pitchProgress = ball.x / 50; // -1 to 1
      const attackSign = myTeam === 'NEWGEN' ? 1 : -1;
      const formationShiftX = pitchProgress * 15 * attackSign;
      const formationShiftZ = (ball.z / 32) * 8;

      let targetX = player.basePosition.x + formationShiftX;
      let targetZ = player.basePosition.z + formationShiftZ;
      let moveSpeed = player.speed * (isAI ? diff.speed : 0.98);

      const distToBall = Math.hypot(player.x - ball.x, player.z - ball.z);
      const amIClosest = (myTeam === 'NEWGEN' && player === closestNewgenPlayer) ||
                         (myTeam === 'NEWEGOISTS' && player === closestEgoistPlayer);
      const isMyTeamInPossession = isTeamPossessing(myTeam);

      // --- STATE: I HAVE POSSESSION OF THE BALL ---
      if (ballPossessor === player) {
        moveSpeed = player.speed * 0.94; // slightly slower while dribbling
        const distToAttackingGoal = Math.hypot(player.x - attackingGoalX, player.z);

        // 1. SHOOTING OPPORTUNITY: If close to goal, take high quality shot!
        if (distToAttackingGoal < 26 && Math.random() < 0.05 * diff.shotAccuracy) {
          player.state = 'kicking';
          // Aim towards corners of net
          const aimCornerZ = (Math.random() > 0.5 ? 4.5 : -4.5) + (Math.random() - 0.5) * 2;
          const dx = attackingGoalX - player.x;
          const dz = aimCornerZ - player.z;
          const d = Math.max(0.1, Math.hypot(dx, dz));
          const shotPower = 25 + Math.random() * 8;
          onKickBall((dx / d) * shotPower, 3.5 + Math.random() * 2.5, (dz / d) * shotPower, myTeam, player.id);
          soundManager.playPowerShot();
        }
        // 2. PASSING OPPORTUNITY: Look for open teammates ahead
        else if (Math.random() < 0.035 * diff.passSkill) {
          const teammates = players.filter(
            (t) => t.team === myTeam && t.id !== player.id && !t.isGoalkeeper
          );

          // Find teammate positioned further forward towards goal with clear line
          let bestPassTarget: PlayerData | null = null;
          let bestScore = -999;

          teammates.forEach((t) => {
            const forwardProgress = (t.x - player.x) * attackSign;
            const tDist = Math.hypot(t.x - player.x, t.z - player.z);
            if (tDist > 6 && tDist < 35 && forwardProgress > -3) {
              // Check opponent pressure on receiver
              const oppPressure = players.filter(
                (op) => op.team === oppTeam && Math.hypot(op.x - t.x, op.z - t.z) < 4.5
              ).length;

              const score = forwardProgress * 1.8 - oppPressure * 6 - tDist * 0.2;
              if (score > bestScore) {
                bestScore = score;
                bestPassTarget = t;
              }
            }
          });

          if (bestPassTarget) {
            player.state = 'kicking';
            const dx = (bestPassTarget as PlayerData).x - player.x;
            const dz = (bestPassTarget as PlayerData).z - player.z;
            const d = Math.max(0.1, Math.hypot(dx, dz));
            const passPwr = Math.min(24, Math.max(14, d * 0.95));
            onKickBall((dx / d) * passPwr, 0.8, (dz / d) * passPwr, myTeam, player.id);
            soundManager.playKick(0.7);
          } else {
            // Dribble towards opponent goal
            targetX = player.x + attackSign * 10;
            targetZ = player.z * 0.8;
          }
        }
        // 3. DRIBBLING / ADVANCING BALL
        else {
          targetX = player.x + attackSign * 12;
          targetZ = player.z * 0.85;
          // Softly push ball ahead
          ball.vx = attackSign * 8;
          ball.vz = (targetZ - player.z) * 0.5;
        }
      }
      // --- STATE: PRESSING / CHASING BALL ---
      else if (amIClosest && (!isMyTeamInPossession || distToBall < diff.pressRange)) {
        // Chase ball proactively with anticipation of ball velocity
        targetX = ball.x + ball.vx * 0.18;
        targetZ = ball.z + ball.vz * 0.18;
        moveSpeed = player.maxSpeed * (isAI ? diff.speed : 0.98);

        // Slide tackle or standing tackle if near opponent with ball
        if (distToBall < 1.6 && Math.random() < 0.035 * diff.reaction) {
          player.state = 'tackling';
          soundManager.playTackle();
          // Poke ball forward towards safety or teammate
          const pokeDirX = attackSign * 14;
          const pokeDirZ = (Math.random() - 0.5) * 12;
          onKickBall(pokeDirX, 1.2, pokeDirZ, myTeam, player.id);
        }
      }
      // --- STATE: OFF-THE-BALL TACTICAL RUNS & SUPPORT ---
      else {
        if (isMyTeamInPossession) {
          // Off-the-ball attacking run (infiltrate into space)
          const runForward = attackSign * 14;
          // Wingers stretch field width, forwards push into box
          let flankSpread = 0;
          if (player.role === 'FW') flankSpread = (player.basePosition.z > 0 ? 1 : -1) * 3;
          targetX = targetBaseX + runForward;
          targetZ = targetBaseZ + flankSpread;
        } else {
          // Defensive recovery shape: drop back and mark opponent
          const dropBack = -attackSign * 10;
          targetX = targetBaseX + dropBack;
          targetZ = targetBaseZ;
        }
      }

      // Smooth steering & acceleration
      const dx = targetX - player.x;
      const dz = targetZ - player.z;
      const distToTarget = Math.hypot(dx, dz);

      if (distToTarget > 0.45) {
        const dirX = dx / distToTarget;
        const dirZ = dz / distToTarget;
        player.vx = dirX * moveSpeed;
        player.vz = dirZ * moveSpeed;

        player.rotation = Math.atan2(dirX, dirZ);
        player.state = moveSpeed > 9 ? 'sprinting' : 'running';
      } else {
        player.vx = 0;
        player.vz = 0;
        if (player.state !== 'kicking' && player.state !== 'tackling') {
          player.state = 'idle';
        }
      }

      // Step position with field boundary collision
      player.x += player.vx * delta;
      player.z += player.vz * delta;
      player.x = Math.max(-49, Math.min(49, player.x));
      player.z = Math.max(-31, Math.min(31, player.z));
    });
  }

  // Goalkeeper logic: diving, shot stopping, and distribution
  private updateGoalkeeper(
    gk: PlayerData,
    ball: BallState,
    delta: number,
    onKickBall: (vx: number, vy: number, vz: number, team: TeamType, playerId: number) => void
  ) {
    const isNewgenGK = gk.team === 'NEWGEN';
    const goalLineX = isNewgenGK ? -47 : 47;
    const opponentGoalX = isNewgenGK ? 50 : -50;

    // Track ball along Z (clamped to goal mouth boundaries)
    const targetZ = Math.max(-6.5, Math.min(6.5, ball.z * 0.78));

    // Rush out if ball is free in penalty box (< 14m)
    const distToBall = Math.hypot(gk.x - ball.x, gk.z - ball.z);
    let targetX = goalLineX;

    if (distToBall < 13 && Math.abs(ball.z) < 14) {
      targetX = isNewgenGK ? Math.min(-38, ball.x) : Math.max(38, ball.x);
    }

    // Goalkeeper Save / Dive when shot is close
    if (distToBall < 2.2 && ball.y < 3.8) {
      gk.state = 'diving';
      // Punch or deflect ball safely out or forward
      const clearDirX = isNewgenGK ? 1 : -1;
      const clearPower = 22 + Math.random() * 8;
      const spreadZ = (Math.random() - 0.5) * 16;
      onKickBall(clearDirX * clearPower, 5 + Math.random() * 4, spreadZ, gk.team, gk.id);
      soundManager.playKick(0.9);
    } else {
      gk.state = 'idle';
    }

    // Smooth movement
    const dz = targetZ - gk.z;
    const dx = targetX - gk.x;
    gk.z += dz * 5.0 * delta;
    gk.x += dx * 4.0 * delta;

    // Face the ball
    gk.rotation = Math.atan2(ball.x - gk.x, ball.z - gk.z);
  }
}

export const aiController = new FootballAIController();
