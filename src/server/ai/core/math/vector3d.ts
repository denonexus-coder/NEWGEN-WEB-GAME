/** 3D Vector for player positions, ball position, forces, etc. */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export function vec3(x = 0, y = 0, z = 0): Vector3D {
  return { x, y, z };
}

export function vecAdd(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vecSub(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vecScale(a: Vector3D, s: number): Vector3D {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function vecDot(a: Vector3D, b: Vector3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vecCross(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vecLength(a: Vector3D): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

export function vecLengthSq(a: Vector3D): number {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}

export function vecNormalize(a: Vector3D): Vector3D {
  const len = vecLength(a);
  if (len < 1e-6) return vec3();
  return vecScale(a, 1 / len);
}

export function vecDistance(a: Vector3D, b: Vector3D): number {
  return vecLength(vecSub(a, b));
}

export function vecDistanceSq(a: Vector3D, b: Vector3D): number {
  return vecLengthSq(vecSub(a, b));
}

export function vecLerp(a: Vector3D, b: Vector3D, t: number): Vector3D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function vecToString(a: Vector3D): string {
  return `(${a.x.toFixed(1)}, ${a.y.toFixed(1)}, ${a.z.toFixed(1)})`;
}