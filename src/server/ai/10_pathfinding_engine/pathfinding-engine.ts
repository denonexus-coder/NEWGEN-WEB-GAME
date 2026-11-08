import { Vector3D, vec3, vecDistance, vecAdd, vecScale, vecNormalize, vecLength } from "../core/math/vector3d";
import { createFieldState, FieldState } from "../core/types/field";

/**
 * Pathfinding Engine
 *
 * Sistema de navegação no campo:
 * - A* em grid para traçar caminhos
 * - Evitacao de obstaculos (adversarios e colegas)
 * - Suavizacao de caminho (string pulling)
 * - Previsao de ponto de interceptacao
 * - Steering / forças de esquiva
 */

export interface Obstacle {
  position: Vector3D;
  radius: number;
}

export interface PathOptions {
  /** Raio do agente que navega (m) */
  agentRadius?: number;
  /** Tamanho da celula do grid (m) */
  gridSize?: number;
  /** Margem de seguranca extra (m) */
  clearance?: number;
  /** Máximo de iteracoes do A* */
  maxIterations?: number;
}

export interface InterceptResult {
  /** Ponto onde o jogador alcanca a bola */
  point: Vector3D;
  /** Tempo estimado ate a interceptacao (s) */
  time: number;
  /** Distancia que o jogador precisa correr (m) */
  distance: number;
  /** Se a bola ainda esta alcancavel */
  reachable: boolean;
}

export class PathfindingEngine {
  private field: FieldState;

  constructor(field?: FieldState) {
    this.field = field || createFieldState();
  }

  // ==================== A* ====================

  /**
   * Encontra caminho do inicio ate o destino evitando obstaculos.
   * Retorna lista de waypoints (vazia se nao houver caminho).
   */
  findPath(
    start: Vector3D,
    goal: Vector3D,
    obstacles: Obstacle[],
    options: PathOptions = {}
  ): Vector3D[] {
    const cellSize = options.gridSize ?? 2;
    const agentRadius = options.agentRadius ?? 1.5;
    const clearance = options.clearance ?? 0.5;
    const maxIterations = options.maxIterations ?? 5000;

    const cols = Math.floor(this.field.width / cellSize) + 1;
    const rows = Math.floor(this.field.height / cellSize) + 1;

    const toCell = (p: Vector3D) => ({
      col: Math.max(0, Math.min(cols - 1, Math.round(p.x / cellSize))),
      row: Math.max(0, Math.min(rows - 1, Math.round(p.y / cellSize))),
    });
    const toPos = (col: number, row: number) =>
      vec3(col * cellSize, row * cellSize, 0);

    const index = (col: number, row: number) => row * cols + col;

    // Celulas bloqueadas
    const blocked = new Uint8Array(cols * rows);
    const cellRadius = agentRadius + clearance;

    for (const obstacle of obstacles) {
      const oc = toCell(obstacle.position);
      const reach = obstacle.radius + cellRadius;
      const reachCells = Math.ceil(reach / cellSize);

      for (let dr = -reachCells; dr <= reachCells; dr++) {
        for (let dc = -reachCells; dc <= reachCells; dc++) {
          const col = oc.col + dc;
          const row = oc.row + dr;
          if (col < 0 || row < 0 || col >= cols || row >= rows) continue;

          const center = toPos(col, row);
          if (vecDistance(center, obstacle.position) <= reach) {
            blocked[index(col, row)] = 1;
          }
        }
      }
    }

    // Celulas fora do campo com margem
    const margin = agentRadius;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const p = toPos(col, row);
        if (
          p.x < margin ||
          p.x > this.field.width - margin ||
          p.y < margin ||
          p.y > this.field.height - margin
        ) {
          blocked[index(col, row)] = 1;
        }
      }
    }

    const startCell = this.nearestFreeCell(toCell(start), blocked, cols, rows, cellSize);
    const goalCell = this.nearestFreeCell(toCell(goal), blocked, cols, rows, cellSize);

    if (!startCell || !goalCell) return [];

    const startIndex = index(startCell.col, startCell.row);
    const goalIndex = index(goalCell.col, goalCell.row);

    const gScore = new Float64Array(cols * rows).fill(Infinity);
    const fScore = new Float64Array(cols * rows).fill(Infinity);
    const cameFrom = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);

    const octile = (a: number, b: number) => {
      const ac = a % cols;
      const ar = Math.floor(a / cols);
      const bc = b % cols;
      const br = Math.floor(b / cols);
      const dx = Math.abs(ac - bc);
      const dy = Math.abs(ar - br);
      return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };

    gScore[startIndex] = 0;
    fScore[startIndex] = octile(startIndex, goalIndex);

    // Open set simples (fila com extracao linear - grid pequeno)
    const open: number[] = [startIndex];
    const inOpen = new Uint8Array(cols * rows);
    inOpen[startIndex] = 1;

    const directions = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, Math.SQRT2],
      [1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [-1, -1, Math.SQRT2],
    ];

    let iterations = 0;
    let found = false;

    while (open.length > 0 && iterations < maxIterations) {
      iterations++;

      // Extrair menor fScore
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (fScore[open[i]] < fScore[open[bestIdx]]) bestIdx = i;
      }
      const current = open[bestIdx];
      open.splice(bestIdx, 1);
      inOpen[current] = 0;

      if (current === goalIndex) {
        found = true;
        break;
      }

      closed[current] = 1;
      const cc = current % cols;
      const cr = Math.floor(current / cols);

      for (const [dc, dr, cost] of directions) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;

        const ni = index(nc, nr);
        if (blocked[ni] || closed[ni]) continue;

        // Evitar "espremer" entre diagonais
        if (dc !== 0 && dr !== 0) {
          if (blocked[index(cc + dc, cr)] || blocked[index(cc, cr + dr)]) continue;
        }

        const tentative = gScore[current] + cost;
        if (tentative < gScore[ni]) {
          cameFrom[ni] = current;
          gScore[ni] = tentative;
          fScore[ni] = tentative + octile(ni, goalIndex);
          if (!inOpen[ni]) {
            open.push(ni);
            inOpen[ni] = 1;
          }
        }
      }
    }

    if (!found) return [];

    // Reconstruir caminho
    const cells: Vector3D[] = [];
    let node = goalIndex;
    while (node !== -1) {
      cells.push(toPos(node % cols, Math.floor(node / cols)));
      if (node === startIndex) break;
      node = cameFrom[node];
    }
    cells.reverse();

    // Substituir celulas extremas por posicoes exatas
    if (cells.length > 0) {
      cells[0] = vec3(start.x, start.y, start.z);
      cells[cells.length - 1] = vec3(goal.x, goal.y, goal.z);
    }

    return cells;
  }

  /**
   * Encontra a celula livre mais proxima (para start/goal bloqueados)
   */
  private nearestFreeCell(
    cell: { col: number; row: number },
    blocked: Uint8Array,
    cols: number,
    rows: number,
    cellSize: number
  ): { col: number; row: number } | null {
    const idx = cell.row * cols + cell.col;
    if (!blocked[idx]) return cell;

    for (let radius = 1; radius < Math.max(cols, rows); radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          const col = cell.col + dc;
          const row = cell.row + dr;
          if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
          if (!blocked[row * cols + col]) return { col, row };
        }
      }
    }
    return null;
  }

  // ==================== SUAVIZACAO ====================

  /**
   * Simplifica o caminho removendo waypoints desnecessarios
   * mantendo linha de visao livre de colisoes.
   */
  smoothPath(path: Vector3D[], obstacles: Obstacle[], agentRadius = 1.5): Vector3D[] {
    if (path.length <= 2) return [...path];

    const smoothed: Vector3D[] = [path[0]];
    let anchor = 0;

    while (anchor < path.length - 1) {
      let furthest = anchor + 1;

      for (let i = path.length - 1; i > anchor + 1; i--) {
        if (this.hasLineOfSight(path[anchor], path[i], obstacles, agentRadius)) {
          furthest = i;
          break;
        }
      }

      smoothed.push(path[furthest]);
      anchor = furthest;
    }

    return smoothed;
  }

  /**
   * Verifica se existe linha de visao livre entre dois pontos
   */
  hasLineOfSight(
    a: Vector3D,
    b: Vector3D,
    obstacles: Obstacle[],
    agentRadius = 1.5
  ): boolean {
    const distance = vecDistance(a, b);
    const steps = Math.max(2, Math.ceil(distance / 0.5));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = vec3(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t,
        a.z + (b.z - a.z) * t
      );

      if (
        point.x < agentRadius ||
        point.x > this.field.width - agentRadius ||
        point.y < agentRadius ||
        point.y > this.field.height - agentRadius
      ) {
        return false;
      }

      for (const obstacle of obstacles) {
        if (vecDistance(point, obstacle.position) < obstacle.radius + agentRadius) {
          return false;
        }
      }
    }

    return true;
  }

  // ==================== INTERCEPTACAO ====================

  /**
   * Preve o ponto onde um jogador alcanca uma bola em movimento.
   */
  predictIntercept(
    ballPosition: Vector3D,
    ballVelocity: Vector3D,
    playerPosition: Vector3D,
    playerSpeed: number,
    maxTime = 5
  ): InterceptResult {
    const dt = 0.05;

    if (playerSpeed <= 0) {
      return {
        point: vec3(ballPosition.x, ballPosition.y, ballPosition.z),
        time: Infinity,
        distance: Infinity,
        reachable: false,
      };
    }

    for (let t = 0; t <= maxTime; t += dt) {
      const ballAt = vec3(
        ballPosition.x + ballVelocity.x * t,
        ballPosition.y + ballVelocity.y * t,
        ballPosition.z + ballVelocity.z * t
      );

      // Fora do campo: bola parada (para em contato)
      if (ballAt.x < 0 || ballAt.x > this.field.width || ballAt.y < 0 || ballAt.y > this.field.height) {
        const clamped = vec3(
          Math.max(0, Math.min(this.field.width, ballAt.x)),
          Math.max(0, Math.min(this.field.height, ballAt.y)),
          0
        );
        const distance = vecDistance(playerPosition, clamped);
        return { point: clamped, time: t, distance, reachable: distance <= playerSpeed * t };
      }

      const distance = vecDistance(playerPosition, ballAt);
      if (distance <= playerSpeed * t) {
        return { point: ballAt, time: t, distance, reachable: true };
      }
    }

    // Nao alcanca dentro do limite: aponta para onde a bola estara
    const finalPoint = vec3(
      ballPosition.x + ballVelocity.x * maxTime,
      ballPosition.y + ballVelocity.y * maxTime,
      0
    );
    const distance = vecDistance(playerPosition, finalPoint);
    return {
      point: finalPoint,
      time: maxTime,
      distance,
      reachable: false,
    };
  }

  // ==================== STEERING ====================

  /**
   * Direcao de movimento desejada (waypoint atual do caminho).
   * Rastreia o progresso: encontra o waypoint mais proximo e mira o
   * proximo a frente, para nunca voltar atras.
   */
  getSteering(path: Vector3D[], current: Vector3D, waypointRadius = 1.5): Vector3D {
    if (path.length === 0) return vec3(0, 0, 0);

    // Indice do waypoint mais proximo
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < path.length; i++) {
      const d = vecDistance(path[i], current);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }

    // Proximo waypoint A FRENTE (a partir do mais proximo)
    let target = path[path.length - 1];
    for (let i = nearestIdx; i < path.length; i++) {
      if (vecDistance(path[i], current) > waypointRadius) {
        target = path[i];
        break;
      }
    }

    const direction = vec3(
      target.x - current.x,
      target.y - current.y,
      target.z - current.z
    );
    const length = vecLength(direction);
    if (length < 0.0001) return vec3(0, 0, 0);
    return vecScale(direction, 1 / length);
  }

  /**
   * Forca de repulsao dos obstaculos proximos (evitacao direta).
   */
  computeAvoidance(
    position: Vector3D,
    desiredDirection: Vector3D,
    obstacles: Obstacle[],
    influenceRadius = 5
  ): Vector3D {
    let avoidance = vec3(0, 0, 0);

    for (const obstacle of obstacles) {
      const distance = vecDistance(position, obstacle.position);
      const reach = obstacle.radius + influenceRadius;

      if (distance >= reach || distance < 0.0001) continue;

      // Direcao para longe do obstaculo
      const away = vec3(
        position.x - obstacle.position.x,
        position.y - obstacle.position.y,
        0
      );
      const awayNorm = vecNormalize(away);
      const strength = (1 - distance / reach) * 2;

      // So desvia se o obstaculo estiver a frente
      const dot =
        awayNorm.x * desiredDirection.x + awayNorm.y * desiredDirection.y;

      avoidance = vecAdd(avoidance, vecScale(awayNorm, strength * Math.max(0, -dot + 0.5)));
    }

    return avoidance;
  }

  /**
   * Custo estimado de um caminho (comprimento + penalizacao de obstaculos)
   */
  getPathCost(path: Vector3D[], obstacles: Obstacle[], agentRadius = 1.5): number {
    if (path.length < 2) return 0;

    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      cost += vecDistance(path[i - 1], path[i]);
    }

    // Penalizacao: passar perto de obstaculos
    for (let i = 1; i < path.length; i++) {
      for (const obstacle of obstacles) {
        const dist = vecDistance(path[i], obstacle.position);
        const clear = obstacle.radius + agentRadius;
        if (dist < clear + 2) {
          cost += (clear + 2 - dist) * 2;
        }
      }
    }

    return cost;
  }
}
