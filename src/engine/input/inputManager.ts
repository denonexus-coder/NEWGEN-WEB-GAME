/** Entrada unificada: teclado + ponteiro/toque + gamepad */
export class InputManager {
  /** teclas mantidas pressionadas */
  readonly keys = new Set<string>();
  /** posição do ponteiro no canvas (CSS px) */
  readonly pointer = { x: 0, y: 0, down: false, button: 0, inside: false };

  private pressed = new Set<string>(); // pressionadas NESTE frame
  private target: HTMLElement | null = null;
  private gamepadIndex: number | null = null;

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.keys.has(e.code)) this.pressed.add(e.code);
    this.keys.add(e.code);
    // evita scroll da página com setas/espaço dentro de jogos
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onPointerMove = (e: PointerEvent) => {
    const rect = (this.target as HTMLElement | null)?.getBoundingClientRect();
    if (!rect) return;
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
    this.pointer.inside = true;
  };

  private onPointerDown = (e: PointerEvent) => {
    this.onPointerMove(e);
    this.pointer.down = true;
    this.pointer.button = e.button;
  };

  private onPointerUp = () => {
    this.pointer.down = false;
  };

  private onPointerLeave = () => {
    this.pointer.inside = false;
    this.pointer.down = false;
  };

  private onGamepadConnected = (e: GamepadEvent) => {
    this.gamepadIndex = e.gamepad.index;
    console.log('[input] gamepad conectado:', e.gamepad.id);
  };

  private onGamepadDisconnected = (e: GamepadEvent) => {
    if (this.gamepadIndex === e.gamepad.index) this.gamepadIndex = null;
  };

  private onBlur = () => {
    this.keys.clear();
    this.pointer.down = false;
  };

  /** anexa listeners (teclado na window, ponteiro no alvo) */
  attach(target: HTMLElement): void {
    this.detach();
    this.target = target;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    target.addEventListener('pointermove', this.onPointerMove);
    target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    target.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    if (this.target) {
      this.target.removeEventListener('pointermove', this.onPointerMove);
      this.target.removeEventListener('pointerdown', this.onPointerDown);
      this.target.removeEventListener('pointerleave', this.onPointerLeave);
    }
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    this.target = null;
  }

  /** tecla mantida pressionada? */
  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** tecla pressionada EXATAMENTE neste frame? */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** gamepad ativo (poll sob demanda) */
  getGamepad(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? [];
    if (this.gamepadIndex !== null && pads[this.gamepadIndex]) return pads[this.gamepadIndex];
    for (const p of pads) if (p) return p;
    return null;
  }

  /** eixos do gamepad (analógicos) — deadzone simples */
  gamepadAxes(): { lx: number; ly: number; rx: number; ry: number } {
    const gp = this.getGamepad();
    if (!gp) return { lx: 0, ly: 0, rx: 0, ry: 0 };
    const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
    return {
      lx: dz(gp.axes[0] ?? 0),
      ly: dz(gp.axes[1] ?? 0),
      rx: dz(gp.axes[2] ?? 0),
      ry: dz(gp.axes[3] ?? 0),
    };
  }

  /** zera "pressionadas neste frame" — chamado no lateUpdate pelo engine */
  endFrame(): void {
    this.pressed.clear();
  }

  dispose(): void {
    this.detach();
    this.keys.clear();
    this.pressed.clear();
  }
}
