class FootballSoundManager {
  private ctx: AudioContext | null = null;
  private crowdNode: AudioNode | null = null;
  private crowdGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8;

  constructor() {
    // AudioContext is initialized on first user interaction to comply with browser autoplay policies
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.startCrowdAmbient();
      }
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.crowdGain && this.ctx) {
      this.crowdGain.gain.setValueAtTime(muted ? 0 : this.volume * 0.15, this.ctx.currentTime);
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.crowdGain && this.ctx && !this.isMuted) {
      this.crowdGain.gain.setValueAtTime(this.volume * 0.15, this.ctx.currentTime);
    }
  }

  // Soft continuous stadium crowd atmosphere
  private startCrowdAmbient() {
    if (!this.ctx || this.crowdNode) return;
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Pink-like filter
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 450;
      bandpass.Q.value = 1.2;

      this.crowdGain = this.ctx.createGain();
      this.crowdGain.gain.value = this.isMuted ? 0 : this.volume * 0.15;

      noise.connect(bandpass);
      bandpass.connect(this.crowdGain);
      this.crowdGain.connect(this.ctx.destination);

      noise.start(0);
      this.crowdNode = noise;
    } catch {
      // Audio not permitted yet
    }
  }

  // Realistic referee whistle sound (frequency modulation)
  public playWhistle(type: 'short' | 'double' | 'long' = 'short') {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    const playBeep = (startTime: number, duration: number) => {
      if (!this.ctx) return;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Twin frequencies create the classic brass pea whistle trill
      osc1.frequency.setValueAtTime(2600, startTime);
      osc2.frequency.setValueAtTime(2850, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(this.volume * 0.45, startTime + 0.02);
      gain.gain.linearRampToValueAtTime(this.volume * 0.4, startTime + duration - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration);
      osc2.stop(startTime + duration);
    };

    const now = this.ctx.currentTime;
    if (type === 'short') {
      playBeep(now, 0.22);
    } else if (type === 'double') {
      playBeep(now, 0.15);
      playBeep(now + 0.22, 0.3);
    } else {
      // Long dramatic half-time / full-time whistle
      playBeep(now, 0.2);
      playBeep(now + 0.28, 0.2);
      playBeep(now + 0.56, 0.75);
    }
  }

  // Ball pass / light kick
  public playKick(power: number = 0.5) {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Frequency sweeps down rapidly for physical kick thud
    const startFreq = 160 + power * 120;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);

    const hitVol = (0.3 + power * 0.4) * this.volume;
    gain.gain.setValueAtTime(hitVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Power shot with heavy bass impact
  public playPowerShot() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    this.playKick(1.0);

    const now = this.ctx.currentTime;
    // Transient pop
    const pop = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(320, now);
    pop.frequency.exponentialRampToValueAtTime(60, now + 0.06);

    popGain.gain.setValueAtTime(0.5 * this.volume, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    pop.connect(popGain);
    popGain.connect(this.ctx.destination);
    pop.start(now);
    pop.stop(now + 0.08);
  }

  // Metallic PING when ball strikes post or crossbar
  public playPostHit() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.6);

    gain.gain.setValueAtTime(0.6 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  // Ball rippling the back of the net
  public playNetSound() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const duration = 0.4;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.1));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4 * this.volume, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch {
      // Ignore
    }
  }

  // Stadium celebration roar when GOAL is scored
  public playGoalRoar() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    this.playWhistle('double');

    // Crowd surge
    try {
      const duration = 2.5;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(550, this.ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 1.0);
      filter.Q.value = 0.8;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.1 * this.volume, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.85 * this.volume, this.ctx.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch {
      // Ignore
    }
  }

  // Slide tackle swoosh
  public playTackle() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);

    gain.gain.setValueAtTime(0.35 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }
}

export const soundManager = new FootballSoundManager();
