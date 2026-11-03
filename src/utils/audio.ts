class SoundEffects {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Check localStorage
    if (typeof window !== 'undefined') {
      this.isMuted = localStorage.getItem('kiban_sfx_muted') === 'true';
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('kiban_sfx_muted', String(this.isMuted));
    }
    if (this.bgmMasterGain && this.ctx) {
      try {
        const targetVol = this.isMuted ? 0 : 0.16;
        this.bgmMasterGain.gain.setValueAtTime(targetVol, this.ctx.currentTime);
      } catch {}
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Jump sound: cheerful arcade spring pitch sweep
  public playJump() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.15);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // AudioContext policy
    }
  }

  // Slide sound: swift low-friction swoosh
  public playSlide() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.18;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.18);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
    } catch {
      // AudioContext policy
    }
  }

  // Chip Pickup: bright crystalline arcade double-ping
  public playChipCollect() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(1318.51, now + 0.06); // E6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // AudioContext policy
    }
  }

  // Crash / Hit: punchy retro impact
  public playCrash() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.32);
    } catch {
      // AudioContext policy
    }
  }

  // Countdown beep
  public playCountdown(isFinal = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFinal ? 880 : 440, now);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // AudioContext policy
    }
  }

  // --------------------------------------------------------------------------
  // BGM (Background Music) - Procedural Web Audio Arcade Cartoon Chiptune Loop
  // --------------------------------------------------------------------------
  private bgmMasterGain: GainNode | null = null;
  private bgmTimerId: any = null;
  private bgmPlaying: boolean = false;
  private currentStep: number = 0;
  private nextNoteTime: number = 0;
  private currentFaction: 'ANGEL' | 'DEVIL' = 'ANGEL';

  public startBgm(faction: 'ANGEL' | 'DEVIL' = 'ANGEL') {
    this.currentFaction = faction;
    this.initContext();
    if (!this.ctx) return;

    if (this.bgmPlaying) {
      return;
    }

    if (!this.bgmMasterGain) {
      this.bgmMasterGain = this.ctx.createGain();
      this.bgmMasterGain.connect(this.ctx.destination);
    }

    const targetVolume = this.isMuted ? 0 : 0.16;
    this.bgmMasterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.bgmMasterGain.gain.linearRampToValueAtTime(targetVolume, this.ctx.currentTime + 0.3);

    this.bgmPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;

    // Scheduler tick every 40ms to schedule ahead
    this.bgmTimerId = setInterval(() => {
      this.scheduleBgmNotes();
    }, 40);
  }

  public stopBgm() {
    if (!this.bgmPlaying) return;
    this.bgmPlaying = false;

    if (this.bgmTimerId) {
      clearInterval(this.bgmTimerId);
      this.bgmTimerId = null;
    }

    if (this.bgmMasterGain && this.ctx) {
      try {
        this.bgmMasterGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      } catch {
        // Safe fallback
      }
    }
  }

  public isBgmActive(): boolean {
    return this.bgmPlaying;
  }

  private scheduleBgmNotes() {
    if (!this.ctx || !this.bgmMasterGain || !this.bgmPlaying) return;

    const scheduleAheadTime = 0.12;
    const stepDuration = 0.115; // ~130 BPM 16th notes

    // 32-step musical progression
    // C Major / A Minor upbeat cartoon melody
    const angelMelody = [
      523.25, 0, 659.25, 783.99,  1046.50, 0, 783.99, 659.25,
      587.33, 0, 698.46, 880.00,  783.99, 0, 659.25, 523.25,
      440.00, 0, 523.25, 659.25,  880.00, 0, 783.99, 659.25,
      698.46, 783.99, 880.00, 987.77, 1046.50, 0, 0, 0
    ];

    const angelBass = [
      130.81, 130.81, 261.63, 130.81,  130.81, 130.81, 261.63, 130.81,
      146.83, 146.83, 293.66, 146.83,  196.00, 196.00, 392.00, 196.00,
      110.00, 110.00, 220.00, 110.00,  110.00, 110.00, 220.00, 110.00,
      174.61, 174.61, 349.23, 174.61,  196.00, 196.00, 392.00, 196.00
    ];

    // Devil: energetic minor rock / chiptune drive
    const devilMelody = [
      440.00, 0, 523.25, 659.25,  622.25, 659.25, 523.25, 440.00,
      392.00, 0, 493.88, 587.33,  659.25, 587.33, 493.88, 392.00,
      349.23, 0, 440.00, 523.25,  587.33, 523.25, 440.00, 349.23,
      329.63, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 0
    ];

    const devilBass = [
      110.00, 110.00, 220.00, 110.00,  110.00, 110.00, 220.00, 110.00,
      98.00,  98.00,  196.00, 98.00,   98.00,  98.00,  196.00, 98.00,
      87.31,  87.31,  174.61, 87.31,   87.31,  87.31,  174.61, 87.31,
      82.41,  82.41,  164.81, 82.41,   98.00,  110.00, 123.47, 130.81
    ];

    const melody = this.currentFaction === 'DEVIL' ? devilMelody : angelMelody;
    const bass = this.currentFaction === 'DEVIL' ? devilBass : angelBass;

    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      const step = this.currentStep % 32;
      const time = this.nextNoteTime;

      // 1. Kick on beat 1, 5, 9, 13 (every 4 steps)
      if (step % 4 === 0) {
        this.playBgmKick(time);
      }

      // 2. Snare on beat 5, 13 (every 8 steps starting at 4)
      if (step % 8 === 4) {
        this.playBgmSnare(time);
      }

      // 3. Hi-hat on offbeats (every 2 steps)
      if (step % 2 === 0) {
        this.playBgmHiHat(time);
      }

      // 4. Bass note
      const bassFreq = bass[step];
      if (bassFreq > 0) {
        this.playBgmBass(bassFreq, time, stepDuration * 0.9);
      }

      // 5. Melody note
      const melodyFreq = melody[step];
      if (melodyFreq > 0) {
        this.playBgmMelody(melodyFreq, time, stepDuration * 0.85);
      }

      this.nextNoteTime += stepDuration;
      this.currentStep++;
    }
  }

  private playBgmKick(time: number) {
    if (!this.ctx || !this.bgmMasterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, time);
      osc.frequency.exponentialRampToValueAtTime(38, time + 0.08);

      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      osc.connect(gain);
      gain.connect(this.bgmMasterGain);

      osc.start(time);
      osc.stop(time + 0.09);
    } catch {}
  }

  private playBgmSnare(time: number) {
    if (!this.ctx || !this.bgmMasterGain) return;
    try {
      // Noise burst for snare snap
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmMasterGain);

      noise.start(time);
    } catch {}
  }

  private playBgmHiHat(time: number) {
    if (!this.ctx || !this.bgmMasterGain) return;
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.025);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(5000, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmMasterGain);

      noise.start(time);
    } catch {}
  }

  private playBgmBass(freq: number, time: number, duration: number) {
    if (!this.ctx || !this.bgmMasterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = this.currentFaction === 'DEVIL' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.bgmMasterGain);

      osc.start(time);
      osc.stop(time + duration + 0.01);
    } catch {}
  }

  private playBgmMelody(freq: number, time: number, duration: number) {
    if (!this.ctx || !this.bgmMasterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, time);

      // Warm retro arcade envelope
      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.bgmMasterGain);

      osc.start(time);
      osc.stop(time + duration + 0.01);
    } catch {}
  }
}

export const sfx = new SoundEffects();
