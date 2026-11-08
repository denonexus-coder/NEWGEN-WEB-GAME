import { Vector3D } from "../math/vector3d";

export interface FieldState {
  width: number;
  height: number;
  goalWidth: number;
  goalDepth: number;
  centerCircleRadius: number;
  penaltyAreaWidth: number;
  penaltyAreaDepth: number;
  cornerArcRadius: number;
}

export function createFieldState(): FieldState {
  return {
    width: 100,
    height: 65,
    goalWidth: 7.34,
    goalDepth: 0.75,
    centerCircleRadius: 9.15,
    penaltyAreaWidth: 40,
    penaltyAreaDepth: 18,
    cornerArcRadius: 1,
  };
}

export function isInsideField(pos: Vector3D, field: FieldState): boolean {
  return pos.x >= 0 && pos.x <= field.width && pos.y >= 0 && pos.y <= field.height;
}

export function isInsidePenaltyArea(pos: Vector3D, field: FieldState): boolean {
  return (
    pos.x >= 32 &&
    pos.x <= 68 &&
    pos.y >= 0 &&
    pos.y <= field.penaltyAreaDepth
  );
}

export function isOutsideField(pos: Vector3D, field: FieldState): boolean {
  return pos.x < 0 || pos.x > field.width || pos.y < 0 || pos.y > field.height;
}