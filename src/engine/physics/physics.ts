export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PhysicsBody {
  id: number;
  position: Vec3;
  velocity: Vec3;
  fixed: boolean;
}

export interface RaycastHit {
  body: PhysicsBody;
  point: Vec3;
  distance: number;
}

export interface BodyDesc {
  position: Vec3;
  mass?: number;
  fixed?: boolean;
}

export interface BoxDesc extends BodyDesc {
  size: Vec3;
}

export interface SphereDesc extends BodyDesc {
  radius: number;
}

/**
 * Contrato de física da engine.
 * Implementação atual: NullPhysics (sem simulação).
 * Próxima etapa: wrapper do Rapier (Rust/WASM) — ver PLANO-ENGINE.md Fase C.
 */
export interface PhysicsWorld {
  readonly name: string;
  /** false = simulação indisponível (jogos devem ter fallback) */
  readonly supported: boolean;
  step(dt: number): void;
  setGravity(gravity: Vec3): void;
  raycast(origin: Vec3, direction: Vec3, maxDistance: number): RaycastHit | null;
  addBox(desc: BoxDesc): PhysicsBody;
  addSphere(desc: SphereDesc): PhysicsBody;
  remove(body: PhysicsBody): void;
  clear(): void;
  dispose(): void;
}

/** Placeholder sem simulação — avisa uma única vez no console */
export class NullPhysicsWorld implements PhysicsWorld {
  readonly name = 'null';
  readonly supported = false;
  private warned = false;
  private nextId = 1;
  private bodies = new Map<number, PhysicsBody>();

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn('[physics] Física não configurada ainda — integrando Rapier na Fase C do PLANO-ENGINE.md');
  }

  step(): void {
    this.warnOnce();
  }

  setGravity(): void {
    this.warnOnce();
  }

  raycast(): RaycastHit | null {
    return null;
  }

  addBox(desc: BoxDesc): PhysicsBody {
    return this.spawn(desc);
  }

  addSphere(desc: SphereDesc): PhysicsBody {
    return this.spawn(desc);
  }

  private spawn(desc: BodyDesc): PhysicsBody {
    const body: PhysicsBody = {
      id: this.nextId++,
      position: { ...desc.position },
      velocity: { x: 0, y: 0, z: 0 },
      fixed: desc.fixed ?? false,
    };
    this.bodies.set(body.id, body);
    return body;
  }

  remove(body: PhysicsBody): void {
    this.bodies.delete(body.id);
  }

  clear(): void {
    this.bodies.clear();
  }

  dispose(): void {
    this.bodies.clear();
  }
}
