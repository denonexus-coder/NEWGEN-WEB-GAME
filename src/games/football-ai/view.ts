/**
 * FootballView — cena three.js do jogo.
 *
 * - Campo100×65 com relva listrada e TODAS as marcações desenhadas em
 *   canvas procedural (offline, zero assets).
 * -22 jogadores (cápsula + cabeça), GK com cor própria, bola com sombra.
 * - Balizas com rede em LineSegments, luzes com sombras, névoa de estádio.
 * - Câmera "broadcast" que segue a bola com suavização exponencial.
 *
 * Mapeamento de coordenadas (campo → mundo):
 *   wx = fieldX − 50        (campo0..100 → mundo −50..50)
 *   wz = 32.5 − fieldY      (campo0..65  → mundo +32.5..−32.5)
 *   rotação.y = yaw do snapshot
 */
import * as THREE from "three";
import { PLAYER_COUNT, PLAYER_STRIDE } from "../../shared/protocol";
import type { TeamInfo } from "../../shared/protocol";
import type { QualityLevel } from "../../engine/types";
import type { SampledState } from "./interpolator";

const FIELD_W = 100;
const FIELD_H = 65;
const GOAL_HALF = 3.67;
const GOAL_H = 2.44;

const fx = (fieldX: number): number => fieldX - 50;
const fz = (fieldY: number): number => 32.5 - fieldY;

function makePitchTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 1331; //65/100 *2048
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const sx = W / FIELD_W;
  const sy = H / FIELD_H;
  const X = (m: number): number => m * sx;
  const Y = (m: number): number => (1 - m / FIELD_H) * H;

  // relva listrada (bandas ao longo do comprimento)
  for (let i = 0; i < 20; i++) {
    g.fillStyle = i % 2 === 0 ? "#3d8b4b" : "#357a43";
    g.fillRect((i * W) / 20, 0, W / 20 + 1, H);
  }
  // leve escurecimento das bandas laterais (profundidade)
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0.12)");
  grad.addColorStop(0.5, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.12)");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const lw = Math.max(2, 0.13 * sx);
  g.strokeStyle = "rgba(255,255,255,0.92)";
  g.lineWidth = lw;
  g.lineCap = "butt";

  // limites (laterais + linhas de baliza)
  g.strokeRect(lw / 2, lw / 2, W - lw, H - lw);

  // eixo médio + círculo central
  g.beginPath();
  g.moveTo(X(50), 0);
  g.lineTo(X(50), H);
  g.stroke();
  g.beginPath();
  g.ellipse(X(50), Y(32.5), 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.beginPath();
  g.ellipse(X(50), Y(32.5), 0.22 * sx, 0.22 * sy, 0, 0, Math.PI * 2);
  g.fill();

  const box = (x0: number, y0: number, w: number, h: number): void => {
    g.strokeRect(X(x0), Y(y0 + h), w * sx, h * sy);
  };
  // áreas (grandes e pequenas) + pontos de penálti
  for (const side of [0, 1]) {
    const gx = side === 1 ? FIELD_W : 0; // linha de baliza desenhada
    const d1 = side === 1 ? gx - 16.5 : 0;
    const d2 = side === 1 ? gx - 5.5 : 0;
    box(d1, 32.5 - 20.16, 16.5, 40.32);
    box(d2, 32.5 - 9.16, 5.5, 18.32);
    const spotX = side === 1 ? gx - 11 : 11;
    g.beginPath();
    g.ellipse(X(spotX), Y(32.5), 0.22 * sx, 0.22 * sy, 0, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** rede da baliza (grelha em LineSegments, plano de fundo + topo) */
function makeGoalNet(side: number): THREE.LineSegments {
  const pts: number[] = [];
  const depth = 2; // metros para trás da linha
  const x0 = side * 0.0; // linha de baliza (local)
  const x1 = side * depth;
  // plano de fundo (x = x1): grelha vertical+horizontal
  for (let z = -GOAL_HALF; z <= GOAL_HALF + 0.01; z += 0.61) {
    pts.push(x1, 0, z, x1, GOAL_H, z);
  }
  for (let y = 0; y <= GOAL_H + 0.01; y += 0.61) {
    pts.push(x1, y, -GOAL_HALF, x1, y, GOAL_HALF);
  }
  // topo (y = GOAL_H)
  for (let z = -GOAL_HALF; z <= GOAL_HALF + 0.01; z += 0.61) {
    pts.push(x0, GOAL_H, z, x1, GOAL_H, z);
  }
  // laterais (z = ±GOAL_HALF)
  for (let y = 0; y <= GOAL_H + 0.01; y += 0.61) {
    pts.push(x0, y, -GOAL_HALF, x1, y, -GOAL_HALF);
    pts.push(x0, y, GOAL_HALF, x1, y, GOAL_HALF);
  }
  for (let t = 0; t <= 1.001; t += 0.5) {
    const x = x0 + (x1 - x0) * t;
    pts.push(x, 0, -GOAL_HALF, x, GOAL_H, -GOAL_HALF);
    pts.push(x, 0, GOAL_HALF, x, GOAL_H, GOAL_HALF);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xe8eef5, transparent: true, opacity: 0.45 });
  return new THREE.LineSegments(geo, mat);
}

function makeGoal(side: number): THREE.Group {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.4 });
  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, GOAL_H, 10);
  for (const z of [-GOAL_HALF, GOAL_HALF]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(0, GOAL_H / 2, z);
    post.castShadow = true;
    group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, GOAL_HALF * 2, 10), postMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0, GOAL_H, 0);
  bar.castShadow = true;
  group.add(bar);
  group.add(makeGoalNet(side));
  return group;
}

function makePlayer(kit: number): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.33, 0.85, 4, 10),
    new THREE.MeshStandardMaterial({ color: kit, roughness: 0.65 })
  );
  body.position.y = 0.76;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8bd96, roughness: 0.8 })
  );
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  // "bico" frontal para ler a direção
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.1, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
  );
  nose.position.set(0.3, 1.0, 0);
  group.add(nose);
  group.userData.body = body;
  return group;
}

export class FootballView {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private players: THREE.Group[] = [];
  private playerBodies: THREE.Mesh[] = [];
  private ball!: THREE.Mesh;
  private homeKit = 0x1d4ed8;
  private awayKit = 0xb91c1c;
  private homeGk = 0xfde047;
  private awayGk = 0xfbbf24;
  private camPos = new THREE.Vector3(0, 46, 78);
  private camLook = new THREE.Vector3(0, 0, 0);
  private disposed = false;

  constructor(quality: QualityLevel) {
    const aspect = Math.max(0.4, window.innerWidth / Math.max(1, window.innerHeight));
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.5, 600);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    this.scene.background = new THREE.Color(0x0b1220);
    this.scene.fog = new THREE.Fog(0x0b1220, 140, 420);

    // ---- relva ----
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_W, FIELD_H),
      new THREE.MeshStandardMaterial({ map: makePitchTexture(), roughness: 0.95, metalness: 0 })
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    this.scene.add(pitch);

    // ---- entorno ----
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 240),
      new THREE.MeshStandardMaterial({ color: 0x101826, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    this.scene.add(ground);

    // arquibancada simples (caixas escuras à volta)
    const standMat = new THREE.MeshStandardMaterial({ color: 0x16203a, roughness: 1 });
    const stands: [number, number, number, number][] = [
      [0, -70, 220, 26],
      [0, 70, 220, 26],
      [-118, 0, 26, 170],
      [118, 0, 26, 170],
    ];
    for (const [x, z, w, d] of stands) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, 14, d), standMat);
      s.position.set(x, 7, z);
      this.scene.add(s);
    }

    // ---- balizas ----
    const goalA = makeGoal(-1); // campo x=0 (mundo −50)
    goalA.position.set(fx(0), 0, 0);
    const goalB = makeGoal(1); // campo x=100 (mundo +50)
    goalB.position.set(fx(100), 0, 0);
    this.scene.add(goalA, goalB);

    // ---- jogadores ----
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const g = makePlayer(this.homeKit);
      this.scene.add(g);
      this.players.push(g);
      this.playerBodies.push(g.userData.body as THREE.Mesh);
    }

    // ---- bola ----
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
    );
    this.ball.castShadow = true;
    this.ball.position.set(0, 0.17, 0);
    this.scene.add(this.ball);

    // ---- luzes ----
    this.scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x2f5c39, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, quality === "low" ? 1.1 : 1.5);
    sun.position.set(45, 90, 35);
    sun.castShadow = true;
    const sm = quality === "high" ? 2048 : 1024;
    sun.shadow.mapSize.set(sm, sm);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -75;
    sc.right = 75;
    sc.top = 55;
    sc.bottom = -55;
    sc.near = 10;
    sc.far = 220;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  setTeams(home: TeamInfo, away: TeamInfo): void {
    this.homeKit = parseInt(home.colors[0].slice(1), 16);
    this.awayKit = parseInt(away.colors[0].slice(1), 16);
    this.homeGk = parseInt(home.colors[2].slice(1), 16);
    this.awayGk = parseInt(away.colors[2].slice(1), 16);
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const isHome = i < 11;
      const isGk = i === 0 || i === 11;
      const kit = isGk ? (isHome ? this.homeGk : this.awayGk) : isHome ? this.homeKit : this.awayKit;
      const body = this.playerBodies[i];
      (body.material as THREE.MeshStandardMaterial).color.setHex(kit);
    }
  }

  /** aplica estado interpolado (coordenadas de campo) */
  apply(s: SampledState): void {
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const b = i * PLAYER_STRIDE;
      const g = this.players[i];
      g.position.set(fx(s.players[b]), 0, fz(s.players[b + 1]));
      g.rotation.y = s.players[b + 3];
    }
    this.ball.position.set(fx(s.ball[0]), Math.max(0.17, s.ball[2] + 0.17), fz(s.ball[1]));
  }

  /** câmera broadcast: segue a bola com suavização exponencial */
  updateCamera(dt: number): void {
    const b = this.ball.position;
    const desiredX = Math.max(-30, Math.min(30, b.x * 0.65));
    const desiredZ = 76 + Math.max(-8, Math.min(8, b.z * 0.25));
    const k = 1 - Math.exp(-2.5 * Math.min(dt, 0.1));
    this.camPos.x += (desiredX - this.camPos.x) * k;
    this.camPos.z += (desiredZ - this.camPos.z) * k;
    this.camPos.y = 46;
    this.camera.position.copy(this.camPos);

    const lookX = b.x * 0.75;
    const lookZ = b.z * 0.35;
    this.camLook.x += (lookX - this.camLook.x) * k;
    this.camLook.z += (lookZ - this.camLook.z) * k;
    this.camera.lookAt(this.camLook);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = Math.max(0.4, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }
}
