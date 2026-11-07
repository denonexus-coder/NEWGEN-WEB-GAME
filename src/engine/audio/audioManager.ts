export type AudioBus = 'master' | 'music' | 'sfx';

export interface SoundHandle {
  stop(): void;
  setVolume(v: number): void;
  playing: boolean;
}

export interface PlayOptions {
  volume?: number;
  rate?: number;
  loop?: boolean;
  bus?: Exclude<AudioBus, 'master'>;
}

/**
 * Áudio unificado sobre Web Audio API:
 * buses master/music/sfx, cache de buffers, música em streaming e unlock de autoplay.
 */
export class AudioManager {
  private _ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private active = new Set<{ stop(): void }>();
  private musicHandle: SoundHandle | null = null;

  volumes = { master: 1, music: 1, sfx: 1 };

  get context(): AudioContext | null {
    return this._ctx;
  }

  /** cria/resume o contexto (chamar em gesto do usuário) */
  unlock(): void {
    try {
      this.ensure();
    } catch (err) {
      console.warn('[audio] não foi possível iniciar o AudioContext:', err);
    }
  }

  setVolumes(v: Partial<{ master: number; music: number; sfx: number }>): void {
    Object.assign(this.volumes, v);
    if (this._ctx) this.applyVolumes();
  }

  private ensure(): AudioContext {
    if (!this._ctx) {
      this._ctx = new AudioContext();
      this.masterGain = this._ctx.createGain();
      this.musicGain = this._ctx.createGain();
      this.sfxGain = this._ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this._ctx.destination);
      this.applyVolumes();
    }
    if (this._ctx.state === 'suspended') void this._ctx.resume();
    return this._ctx;
  }

  private applyVolumes(): void {
    if (!this._ctx) return;
    this.masterGain.gain.value = this.volumes.master;
    this.musicGain.gain.value = this.volumes.music;
    this.sfxGain.gain.value = this.volumes.sfx;
  }

  /** carrega e decodifica um áudio (cacheado) — aceita blob:/data:/http: */
  async load(url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const ctx = this.ensure();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[audio] falha ao baixar: ${url} (${res.status})`);
    const raw = await res.arrayBuffer();
    const buffer = await ctx.decodeAudioData(raw);
    this.buffers.set(url, buffer);
    return buffer;
  }

  /** toca um efeito sonoro (SFX) */
  async play(url: string, opts: PlayOptions = {}): Promise<SoundHandle> {
    const buffer = await this.load(url);
    return this.playBuffer(buffer, opts);
  }

  /** toca um AudioBuffer já decodificado */
  playBuffer(buffer: AudioBuffer, opts: PlayOptions = {}): SoundHandle {
    const ctx = this.ensure();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = opts.loop ?? false;
    source.playbackRate.value = opts.rate ?? 1;

    const gain = ctx.createGain();
    gain.gain.value = opts.volume ?? 1;
    source.connect(gain);
    gain.connect(opts.bus === 'music' ? this.musicGain : this.sfxGain);

    const handle: SoundHandle = {
      playing: true,
      stop: () => {
        try {
          source.stop();
        } catch {
          /* já parado */
        }
        handle.playing = false;
        this.active.delete(handle);
      },
      setVolume: (v: number) => {
        gain.gain.value = v;
      },
    };
    source.onended = () => {
      handle.playing = false;
      this.active.delete(handle);
    };
    this.active.add(handle);
    source.start();
    return handle;
  }

  /** toca música (para a anterior automaticamente) */
  async playMusic(url: string, opts: PlayOptions = {}): Promise<SoundHandle> {
    this.stopMusic();
    const handle = await this.play(url, { ...opts, loop: opts.loop ?? true, bus: 'music' });
    this.musicHandle = handle;
    return handle;
  }

  stopMusic(): void {
    this.musicHandle?.stop();
    this.musicHandle = null;
  }

  /** para todos os sons ativos */
  stopAll(): void {
    this.stopMusic();
    for (const h of [...this.active]) h.stop();
    this.active.clear();
  }

  dispose(): void {
    this.stopAll();
    this.buffers.clear();
    if (this._ctx) void this._ctx.close();
    this._ctx = null;
  }
}
