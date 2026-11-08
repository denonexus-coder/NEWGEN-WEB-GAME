export class GameTime {
  private _elapsedTime: number = 0;
  private _lastUpdate: number = 0;
  private _deltaTime: number = 0;

  constructor() {
    this._lastUpdate = Date.now();
  }

  get currentTime(): number {
    return this._elapsedTime;
  }

  get elapsedTime(): number {
    return this._elapsedTime;
  }

  get deltaTime(): number {
    return this._deltaTime;
  }

  start(): void {
    this._lastUpdate = Date.now();
  }

  stop(): void {
    this._lastUpdate = Date.now();
  }

  reset(): void {
    this._elapsedTime = 0;
    this._lastUpdate = Date.now();
  }

  advanceTime(seconds: number): void {
    this._elapsedTime += seconds;
  }

  update(): void {
    const now = Date.now();
    const elapsed = (now - this._lastUpdate) / 1000;
    this._deltaTime = elapsed;
    this._elapsedTime += elapsed;
    this._lastUpdate = now;
  }
}