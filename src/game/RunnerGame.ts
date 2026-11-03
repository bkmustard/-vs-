import { sfx } from '../utils/audio.js';

export type GameFaction = 'ANGEL' | 'DEVIL';

export type GameState = 'READY' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export interface GameMetrics {
  score: number;
  distance: number;
  chipsCollected: number;
  speed: number;
  durationSeconds: number;
  jumpsCount: number;
  slidesCount: number;
  feverMeter: number;
  isFeverActive: boolean;
  feverTimer: number;
}

export interface Obstacle {
  id: number;
  type: 'SPIKE' | 'AERIAL' | 'BOX' | 'CEILING' | 'DROPPER' | 'SURGE' | 'HOPPER' | 'BOBBING_ORB' | 'LIFTING_GATE';
  x: number;
  y: number;
  width: number;
  height: number;
  passed: boolean;
  dropState?: 'WAIT' | 'DROPPING' | 'LANDED';
  targetY?: number;
  dropVy?: number;
  warningPhase?: number;
  surgeState?: 'DORMANT' | 'WARNING' | 'ERUPTING' | 'PEAK';
  surgeVy?: number;
  movePhase?: number;
  moveCenterY?: number;
  moveAmplitude?: number;
  moveSpeed?: number;
}

export interface Platform {
  id: number;
  x: number;
  y: number; // Top surface level (e.g. 290 or 310)
  width: number;
  height: number;
}

export interface CollectibleItem {
  id: number;
  type: 'CHIP' | 'FEVER';
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
  bobPhase: number;
}

// Backwards compatibility alias
export type CollectibleChip = CollectibleItem;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface FloatText {
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  life: number;
}

export class RunnerGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private faction: GameFaction;

  // Assets
  private playerImg: HTMLImageElement;
  private chipImg: HTMLImageElement;
  private isAssetsLoaded = false;

  // Game Dimensions (Virtual coordinates 960 x 500)
  public readonly V_WIDTH = 960;
  public readonly V_HEIGHT = 500;
  public readonly GROUND_Y = 410; // Ground surface level

  // State
  public state: GameState = 'READY';
  private countdownTimer = 3;
  private countdownAccumulator = 0;
  private isGameOverTriggered = false;

  // Player physics
  private player = {
    x: 140,
    y: 340, // Grounded at 410 - 70 = 340
    baseWidth: 70,
    baseHeight: 70,
    vy: 0,
    isJumping: false,
    isSliding: false,
    isGrounded: true,
    currentPlatform: null as Platform | null,
    rotation: 0,
    hitAnimProgress: 0,
    bouncePhase: 0,
  };

  // Metrics
  private score = 0;
  private distance = 0;
  private chipsCollected = 0;
  private speed = 460;
  private gameStartTime = 0;
  private jumpsCount = 0;
  private slidesCount = 0;

  // Fever Mode System
  private feverMeter = 0; // 0 - 100
  private isFeverActive = false;
  private feverDuration = 6.0;
  private feverTimer = 0;
  private postFeverInvulnerabilityTime = 0;

  // Spawning & Environment
  private obstacles: Obstacle[] = [];
  private platforms: Platform[] = [];
  private chips: CollectibleItem[] = [];
  private particles: Particle[] = [];
  private floatTexts: FloatText[] = [];
  private nextObstacleDistance = 420;
  private groundScroll = 0;
  private backgroundScroll1 = 0;
  private backgroundScroll2 = 0;
  private screenShakeTime = 0;
  private deathExplosionTime = 0;
  private deathExplosionX = 0;
  private deathExplosionY = 0;

  // Animation frame
  private animationFrameId: number | null = null;
  private lastTime = 0;

  // Callbacks
  private onGameOverCb?: (metrics: GameMetrics) => void;
  private onMetricsUpdateCb?: (metrics: GameMetrics) => void;

  constructor(canvas: HTMLCanvasElement, faction: GameFaction) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.faction = faction;

    this.playerImg = new Image();
    const spritePath = faction === 'ANGEL' ? '/assets/angel.png' : '/assets/devil.png';
    this.playerImg.src = spritePath;

    this.chipImg = new Image();
    this.chipImg.src = '/assets/chip.png';

    let loadedCount = 0;
    const checkReady = () => {
      loadedCount++;
      if (loadedCount >= 2) {
        this.isAssetsLoaded = true;
      }
    };
    this.playerImg.onload = checkReady;
    this.playerImg.onerror = () => {
      this.isAssetsLoaded = true;
    };
    this.chipImg.onload = checkReady;
    this.chipImg.onerror = () => {
      this.isAssetsLoaded = true;
    };

    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize);
    this.setupInputs();
  }

  private handleResize = () => {
    this.resizeCanvas();
  };

  public setCallbacks(options: {
    onGameOver?: (metrics: GameMetrics) => void;
    onMetricsUpdate?: (metrics: GameMetrics) => void;
  }) {
    this.onGameOverCb = options.onGameOver;
    this.onMetricsUpdateCb = options.onMetricsUpdate;
  }

  private resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    this.canvas.width = this.V_WIDTH * dpr;
    this.canvas.height = this.V_HEIGHT * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  private setupInputs() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.state !== 'PLAYING') return;

    if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      this.triggerJump();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      this.triggerSlide(true);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      this.triggerSlide(false);
    }
  };

  public triggerJump() {
    if (this.state !== 'PLAYING') return;

    // Immediately cancel sliding if jump is triggered
    if (this.player.isSliding) {
      this.player.isSliding = false;
    }

    if (this.player.isGrounded) {
      this.player.isGrounded = false;
      this.player.isJumping = true;
      this.player.currentPlatform = null;
      // Slightly lower jump for tighter obstacle clears
      this.player.vy = -680;
      this.jumpsCount++;
      sfx.playJump();

      this.spawnJumpParticles();
    }
  }

  public triggerSlide(isPressed: boolean) {
    if (this.state !== 'PLAYING') return;
    if (isPressed) {
      if (this.player.isGrounded && !this.player.isSliding) {
        this.player.isSliding = true;
        this.slidesCount++;
        sfx.playSlide();
        this.spawnSlideParticles();
      }
    } else {
      this.player.isSliding = false;
    }
  }

  public startCountdown() {
    if (this.state === 'COUNTDOWN' || this.state === 'PLAYING') return;
    this.state = 'COUNTDOWN';
    this.countdownTimer = 3;
    this.countdownAccumulator = 0;
    this.isGameOverTriggered = false;
    sfx.playCountdown(false);
  }

  public pause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      sfx.stopBgm();
    }
  }

  public resume() {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.lastTime = performance.now();
      sfx.startBgm(this.faction);
    }
  }

  public startLoop() {
    this.lastTime = performance.now();
    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      this.update(dt);
      this.render();

      if (this.animationFrameId !== null) {
        this.animationFrameId = requestAnimationFrame(loop);
      }
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public destroy() {
    sfx.stopBgm();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('resize', this.handleResize);
  }

  private update(dt: number) {
    if (this.state === 'COUNTDOWN') {
      this.countdownAccumulator += dt;
      if (this.countdownAccumulator >= 1.0) {
        this.countdownAccumulator -= 1.0;
        this.countdownTimer--;
        if (this.countdownTimer > 0) {
          sfx.playCountdown(false);
        } else if (this.countdownTimer === 0) {
          sfx.playCountdown(true);
          this.state = 'PLAYING';
          this.gameStartTime = Date.now();
          sfx.startBgm(this.faction);
        }
      }
      return;
    }

    if (this.state === 'READY') {
      this.player.bouncePhase += dt * 8;
      this.updateParticles(dt);
      return;
    }

    if (this.state === 'GAMEOVER') {
      this.deathExplosionTime = Math.max(0, this.deathExplosionTime - dt);
      this.screenShakeTime = Math.max(0, this.screenShakeTime - dt);
      this.updateParticles(dt);
      this.updateFloatTexts(dt);
      return;
    }

    if (this.state !== 'PLAYING') return;

    // Update Fever Mode
    if (this.postFeverInvulnerabilityTime > 0) {
      this.postFeverInvulnerabilityTime = Math.max(0, this.postFeverInvulnerabilityTime - dt);
    }
    if (this.isFeverActive) {
      this.feverTimer -= dt;
      this.spawnFeverTrailParticles();
      if (this.feverTimer <= 0) {
        this.isFeverActive = false;
        this.feverTimer = 0;
        this.feverMeter = 0;
        this.postFeverInvulnerabilityTime = 0.25;
        this.addFloatText('FEVER END', this.player.x + 35, this.player.y - 20, '#94a3b8');
      }
    }

    // Progressive speed curve: base speed increases with distance (starts 460 up to 960 px/s)
    // In Fever Mode: supersonic rush (1.82x normal speed!)
    const distanceBonus = Math.min(500, this.distance / 4.5);
    const baseSpeed = 460 + distanceBonus;
    this.speed = this.isFeverActive ? baseSpeed * 1.82 : baseSpeed;

    const frameDistance = this.speed * dt;
    this.distance += frameDistance / 20; // meters
    this.score += frameDistance * (this.isFeverActive ? 0.95 : 0.55);

    // Parallax background scrolls
    this.groundScroll = (this.groundScroll + frameDistance) % 60;
    this.backgroundScroll1 = (this.backgroundScroll1 + frameDistance * 0.22) % this.V_WIDTH;
    this.backgroundScroll2 = (this.backgroundScroll2 + frameDistance * 0.55) % this.V_WIDTH;

    // -------------------------------------------------------------
    // Update Platforms & Platform Landing Physics
    // -------------------------------------------------------------
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      const plat = this.platforms[i];
      plat.x -= frameDistance;
      if (plat.x + plat.width < -120) {
        this.platforms.splice(i, 1);
      }
    }

    const playerFeetY = this.player.y + this.player.baseHeight;
    const playerLeft = this.player.x + 12;
    const playerRight = this.player.x + this.player.baseWidth - 12;

    // Check landing on elevated platform (one-way platform from above)
    if (!this.player.isGrounded || this.player.currentPlatform) {
      for (const plat of this.platforms) {
        if (playerRight > plat.x && playerLeft < plat.x + plat.width) {
          // If feet cross near platform top while moving downwards
          if (playerFeetY >= plat.y && playerFeetY <= plat.y + 28 && this.player.vy >= 0) {
            this.player.y = plat.y - this.player.baseHeight;
            this.player.vy = 0;
            this.player.isGrounded = true;
            this.player.isJumping = false;
            this.player.currentPlatform = plat;
            this.spawnLandingParticles();
            break;
          }
        }
      }
    }

    // Check walking off platform edge
    if (this.player.currentPlatform) {
      const plat = this.player.currentPlatform;
      if (playerRight < plat.x || playerLeft > plat.x + plat.width) {
        this.player.isGrounded = false;
        this.player.currentPlatform = null;
      }
    }

    // -------------------------------------------------------------
    // Player Vertical Physics (Gravity & Landing)
    // -------------------------------------------------------------
    const gravity = 2100; // px/s^2
    if (!this.player.isGrounded) {
      this.player.vy += gravity * dt;
      this.player.y += this.player.vy * dt;

      // Parabolic tilt
      this.player.rotation = Math.min(0.35, Math.max(-0.35, this.player.vy * 0.0004));

      // Landing on Ground check
      if (this.player.y + this.player.baseHeight >= this.GROUND_Y) {
        this.player.y = this.GROUND_Y - this.player.baseHeight;
        this.player.vy = 0;
        this.player.isGrounded = true;
        this.player.isJumping = false;
        this.player.currentPlatform = null;
        this.player.rotation = 0;
        this.spawnLandingParticles();
      }
    } else {
      this.player.bouncePhase += dt * (13 + (this.speed - 450) * 0.02);
      this.player.rotation = 0;

      if (Math.random() < 0.3) {
        this.spawnRunParticle();
      }
    }

    // Spawn obstacles, platforms, and chips
    this.updateSpawner(frameDistance);

    // -------------------------------------------------------------
    // Update Obstacles (including DROPPER & SURGE Hazards)
    // -------------------------------------------------------------
    const playerHitbox = this.getCurrentHitbox();
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= frameDistance;

      if (obs.movePhase !== undefined && obs.moveCenterY !== undefined && obs.moveAmplitude !== undefined) {
        obs.movePhase += dt * (obs.moveSpeed || 1);
        obs.y = obs.moveCenterY + Math.sin(obs.movePhase) * obs.moveAmplitude;
      }

      // Handle Sudden Descending Obstacle (DROPPER)
      if (obs.type === 'DROPPER') {
        if (obs.dropState === 'WAIT') {
          obs.warningPhase = (obs.warningPhase || 0) + dt * 12;
          if (obs.x - this.player.x < 340) {
            obs.dropState = 'DROPPING';
          }
        } else if (obs.dropState === 'DROPPING') {
          obs.dropVy = (obs.dropVy || 0) + 3400 * dt;
          obs.y += (obs.dropVy || 0) * dt;
          const target = obs.targetY || (this.GROUND_Y - obs.height);
          if (obs.y >= target) {
            obs.y = target;
            obs.dropState = 'LANDED';
            this.screenShakeTime = 0.22;
            sfx.playCrash();
            this.spawnImpactParticles(obs.x + obs.width / 2, obs.y + obs.height);
          }
        }
      }

      // Handle Rising Erupting Obstacle (SURGE)
      if (obs.type === 'SURGE') {
        const distToPlayer = obs.x - this.player.x;
        if (obs.surgeState === 'DORMANT') {
          if (distToPlayer < 450) {
            obs.surgeState = 'WARNING';
          }
        }
        if (obs.surgeState === 'WARNING') {
          obs.warningPhase = (obs.warningPhase || 0) + dt * 14;
          // Spawn little ground rumble particles while warming up
          if (Math.random() < 0.25) {
            this.particles.push({
              x: obs.x + Math.random() * obs.width,
              y: this.GROUND_Y,
              vx: (Math.random() - 0.5) * 60,
              vy: -(Math.random() * 50 + 20),
              size: Math.random() * 3 + 2,
              color: this.faction === 'ANGEL' ? '#fde047' : '#ef4444',
              alpha: 0.8,
              life: 0,
              maxLife: 0.3,
            });
          }
          if (distToPlayer < 280) {
            obs.surgeState = 'ERUPTING';
            obs.surgeVy = -1150;
            sfx.playCrash();
            this.screenShakeTime = 0.16;
            this.spawnImpactParticles(obs.x + obs.width / 2, this.GROUND_Y);
          }
        } else if (obs.surgeState === 'ERUPTING') {
          // Rapidly surge upwards
          const target = obs.targetY || (this.GROUND_Y - obs.height);
          obs.y += (obs.surgeVy || -1150) * dt;
          if (obs.y <= target) {
            obs.y = target;
            obs.surgeState = 'PEAK';
          }
        }
      }

      // Collision check
      if (!obs.passed && this.checkCollision(playerHitbox, obs)) {
        if (this.postFeverInvulnerabilityTime > 0) {
          obs.passed = true;
          this.obstacles.splice(i, 1);
          continue;
        } else if (this.isFeverActive) {
          // SMASH OBSTACLE IN FEVER MODE!
          obs.passed = true;
          this.obstacles.splice(i, 1);
          this.score += 400;
          this.screenShakeTime = 0.24;
          sfx.playCrash();
          this.spawnDebrisShatterParticles(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.type);
          this.addFloatText('💥 SMASH! +400', obs.x + obs.width / 2, obs.y - 10, '#fde047');
          continue;
        } else {
          this.triggerGameOver();
          return;
        }
      }

      if (!obs.passed && obs.x + obs.width < this.player.x) {
        obs.passed = true;
        this.score += 50;
      }

      if (obs.x + obs.width < -120) {
        this.obstacles.splice(i, 1);
      }
    }

    // Update collectible items (Chips and Fever Orbs)
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const chip = this.chips[i];
      chip.x -= frameDistance;
      chip.bobPhase += dt * 6;

      if (!chip.collected && this.checkChipCollection(playerHitbox, chip)) {
        chip.collected = true;
        if (chip.type === 'FEVER') {
          this.feverMeter = Math.min(100, this.feverMeter + 25);
          this.score += 200;
          sfx.playChipCollect();
          this.spawnFeverCollectParticles(chip.x + 16, chip.y + 16);
          this.addFloatText('+25% FEVER!', chip.x, chip.y - 12, '#38bdf8');
          if (this.feverMeter >= 100 && !this.isFeverActive) {
            this.activateFeverMode();
          }
        } else {
          this.chipsCollected++;
          this.score += 150;
          sfx.playChipCollect();
          this.spawnChipParticles(chip.x + 16, chip.y + 16);
          this.addFloatText('+1 CHIP!', chip.x, chip.y - 12, '#facc15');
        }
        this.chips.splice(i, 1);
        continue;
      }

      if (chip.x + chip.width < -100) {
        this.chips.splice(i, 1);
      }
    }

    // Update particles & float texts
    this.updateParticles(dt);
    this.updateFloatTexts(dt);

    if (this.screenShakeTime > 0) {
      this.screenShakeTime -= dt;
    }

    this.emitMetrics();
  }

  public getCurrentHitbox() {
    const isSliding = this.player.isSliding && this.player.isGrounded;
    const width = isSliding ? 60 : 44;
    const height = isSliding ? 26 : 48;
    const x = this.player.x + (isSliding ? 5 : 13);
    const y = isSliding
      ? (this.player.currentPlatform ? this.player.currentPlatform.y - height : this.GROUND_Y - height)
      : this.player.y + (this.player.baseHeight - height) / 2;

    return { x, y, width, height };
  }

  private checkCollision(
    p: { x: number; y: number; width: number; height: number },
    obs: Obstacle
  ): boolean {
    const pad = 4;
    return (
      p.x + pad < obs.x + obs.width - pad &&
      p.x + p.width - pad > obs.x + pad &&
      p.y + pad < obs.y + obs.height - pad &&
      p.y + p.height - pad > obs.y + pad
    );
  }

  private checkChipCollection(
    p: { x: number; y: number; width: number; height: number },
    chip: CollectibleChip
  ): boolean {
    const margin = 8;
    return (
      p.x - margin < chip.x + chip.width &&
      p.x + p.width + margin > chip.x &&
      p.y - margin < chip.y + chip.height &&
      p.y + p.height + margin > chip.y
    );
  }

  public activateFeverMode() {
    this.isFeverActive = true;
    this.feverDuration = 6.0;
    this.feverTimer = 6.0;
    this.screenShakeTime = 0.35;
    sfx.playCrash();
    this.addFloatText('🔥 FEVER MODE! 🔥', this.player.x + 35, this.player.y - 35, '#fde047');
  }

  private updateSpawner(frameDistance: number) {
    this.nextObstacleDistance -= frameDistance;
    if (this.nextObstacleDistance <= 0) {
      this.spawnPattern();
      // Progressive difficulty: as distance increases, obstacles spawn more frequently!
      const progressFactor = Math.min(1.0, this.distance / 2500);
      const minGap = Math.max(180, 480 - progressFactor * 260);
      const randomGap = Math.random() * Math.max(40, 140 - progressFactor * 80);
      this.nextObstacleDistance = minGap + randomGap;
    }
  }

  private spawnPattern() {
    // 11 obstacle patterns including three vertically moving hazards!
    const patternType = Math.floor(Math.random() * 11);
    const startX = this.V_WIDTH + 80;

    switch (patternType) {
      case 0: {
        // 1. Ground Spikes
        const width = 44;
        const height = 36;
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'SPIKE',
          x: startX,
          y: this.GROUND_Y - height,
          width,
          height,
          passed: false,
        });

        for (let i = 0; i < 3; i++) {
          this.chips.push({
            id: Date.now() + Math.random(),
            type: i === 1 ? 'FEVER' : 'CHIP',
            x: startX - 25 + i * 46,
            y: this.GROUND_Y - 110 - Math.sin((i / 2) * Math.PI) * 45,
            width: 30,
            height: 30,
            collected: false,
            bobPhase: i,
          });
        }
        break;
      }
      case 1: {
        // 2. Low Ceiling (Slide under)
        const clearance = 48;
        const height = this.GROUND_Y - clearance;
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'CEILING',
          x: startX,
          y: 0,
          width: 85,
          height,
          passed: false,
        });

        this.chips.push({
          id: Date.now() + Math.random(),
          type: 'FEVER',
          x: startX + 28,
          y: this.GROUND_Y - 30,
          width: 28,
          height: 28,
          collected: false,
          bobPhase: 0,
        });
        break;
      }
      case 2: {
        // 3. High Aerial Flying Hazard (Slide under)
        const height = 44;
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'AERIAL',
          x: startX,
          y: this.GROUND_Y - 96,
          width: 58,
          height,
          passed: false,
        });

        this.chips.push({
          id: Date.now() + Math.random(),
          type: 'CHIP',
          x: startX + 14,
          y: this.GROUND_Y - 30,
          width: 28,
          height: 28,
          collected: false,
          bobPhase: 0,
        });
        break;
      }
      case 3: {
        // 4. Crate Box (Jump over)
        const boxSize = 48;
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'BOX',
          x: startX,
          y: this.GROUND_Y - boxSize,
          width: boxSize,
          height: boxSize,
          passed: false,
        });

        this.chips.push({
          id: Date.now() + Math.random(),
          type: 'FEVER',
          x: startX + 9,
          y: this.GROUND_Y - 120,
          width: 30,
          height: 30,
          collected: false,
          bobPhase: 0,
        });
        break;
      }
      case 4: {
        // 5. Floating Stepping Platform Section
        const platWidth = 170;
        const platY = this.GROUND_Y - 95;
        this.platforms.push({
          id: Date.now() + Math.random(),
          x: startX,
          y: platY,
          width: platWidth,
          height: 20,
        });

        // Danger spikes on ground below the platform
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'SPIKE',
          x: startX + 50,
          y: this.GROUND_Y - 36,
          width: 44,
          height: 36,
          passed: false,
        });

        // Event chips & Fever Orb on top of the platform
        for (let i = 0; i < 3; i++) {
          this.chips.push({
            id: Date.now() + Math.random(),
            type: i === 1 ? 'FEVER' : 'CHIP',
            x: startX + 20 + i * 50,
            y: platY - 45,
            width: 30,
            height: 30,
            collected: false,
            bobPhase: i,
          });
        }
        break;
      }
      case 5: {
        // 6. Sudden Dropping Crusher Hazard (Dropper)
        const dropWidth = 52;
        const dropHeight = 52;
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'DROPPER',
          x: startX,
          y: -100,
          width: dropWidth,
          height: dropHeight,
          passed: false,
          dropState: 'WAIT',
          targetY: this.GROUND_Y - dropHeight,
          dropVy: 0,
          warningPhase: 0,
        });

        this.chips.push({
          id: Date.now() + Math.random(),
          type: 'CHIP',
          x: startX + 11,
          y: this.GROUND_Y - 125,
          width: 30,
          height: 30,
          collected: false,
          bobPhase: 0,
        });
        break;
      }
      case 6: {
        // 7. NEW: Rising Erupting Spire (SURGE)!
        // Starts underground at GROUND_Y, erupts upwards as player approaches!
        const surgeWidth = 48;
        const surgeHeight = 60;
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'SURGE',
          x: startX,
          y: this.GROUND_Y,
          width: surgeWidth,
          height: surgeHeight,
          passed: false,
          surgeState: 'DORMANT',
          targetY: this.GROUND_Y - surgeHeight,
          surgeVy: 0,
          warningPhase: 0,
        });

        // Arc of chips leaping over the surge
        for (let i = 0; i < 3; i++) {
          this.chips.push({
            id: Date.now() + Math.random(),
            type: i === 1 ? 'FEVER' : 'CHIP',
            x: startX - 25 + i * 48,
            y: this.GROUND_Y - 130 - Math.sin((i / 2) * Math.PI) * 40,
            width: 30,
            height: 30,
            collected: false,
            bobPhase: i,
          });
        }
        break;
      }
      case 8: {
        // Vertically hopping crystal: jump over it while it drops low.
        const width = 52;
        const height = 40;
        const moveCenterY = this.GROUND_Y - height - 24;
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'HOPPER',
          x: startX,
          y: moveCenterY,
          width,
          height,
          passed: false,
          movePhase: Math.random() * Math.PI * 2,
          moveCenterY,
          moveAmplitude: 24,
          moveSpeed: 3.4,
        });
        break;
      }
      case 9: {
        // Bobbing low orb: its lower swing can be ducked under.
        const width = 48;
        const height = 44;
        const moveCenterY = this.GROUND_Y - 132;
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'BOBBING_ORB',
          x: startX,
          y: moveCenterY,
          width,
          height,
          passed: false,
          movePhase: Math.random() * Math.PI * 2,
          moveCenterY,
          moveAmplitude: 32,
          moveSpeed: 2.6,
        });
        break;
      }
      case 10: {
        // Lifting overhead gate: stay grounded while it moves.
        const width = 100;
        const height = 76;
        const moveCenterY = 238;
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'LIFTING_GATE',
          x: startX,
          y: moveCenterY,
          width,
          height,
          passed: false,
          movePhase: Math.random() * Math.PI * 2,
          moveCenterY,
          moveAmplitude: 24,
          moveSpeed: 1.9,
        });
        break;
      }
      case 7:
      default: {
        // 8. NEW: Fever Rush Arc (Double Fever Orbs + Spikes)
        const width = 44;
        const height = 36;
        this.obstacles.push({
          id: Date.now() + Math.random(),
          type: 'SPIKE',
          x: startX + 60,
          y: this.GROUND_Y - height,
          width,
          height,
          passed: false,
        });

        this.chips.push({
          id: Date.now() + Math.random(),
          type: 'FEVER',
          x: startX,
          y: this.GROUND_Y - 35,
          width: 30,
          height: 30,
          collected: false,
          bobPhase: 0,
        });

        this.chips.push({
          id: Date.now() + Math.random(),
          type: 'FEVER',
          x: startX + 68,
          y: this.GROUND_Y - 125,
          width: 30,
          height: 30,
          collected: false,
          bobPhase: 1,
        });

        this.chips.push({
          id: Date.now() + Math.random(),
          type: 'CHIP',
          x: startX + 135,
          y: this.GROUND_Y - 35,
          width: 30,
          height: 30,
          collected: false,
          bobPhase: 2,
        });
        break;
      }
    }
  }

  private triggerGameOver() {
    if (this.isGameOverTriggered) return;
    this.isGameOverTriggered = true;
    this.state = 'GAMEOVER';
    this.screenShakeTime = 0.62;
    this.deathExplosionTime = 0.58;
    sfx.stopBgm();
    sfx.playDeathExplosion();

    const hb = this.getCurrentHitbox();
    this.deathExplosionX = hb.x + hb.width / 2;
    this.deathExplosionY = hb.y + hb.height / 2;
    this.spawnDeathExplosionParticles(this.deathExplosionX, this.deathExplosionY);

    const metrics = this.getMetrics();
    setTimeout(() => {
      this.onGameOverCb?.(metrics);
    }, 550);
  }

  public getMetrics(): GameMetrics {
    const durationSeconds = this.gameStartTime > 0 ? (Date.now() - this.gameStartTime) / 1000 : 0;
    return {
      score: Math.floor(this.score),
      distance: Math.floor(this.distance),
      chipsCollected: this.chipsCollected,
      speed: Math.floor(this.speed),
      durationSeconds: Math.floor(durationSeconds),
      jumpsCount: this.jumpsCount,
      slidesCount: this.slidesCount,
      feverMeter: Math.floor(this.feverMeter),
      isFeverActive: this.isFeverActive,
      feverTimer: Math.max(0, Math.round(this.feverTimer * 10) / 10),
    };
  }

  private emitMetrics() {
    if (this.onMetricsUpdateCb) {
      this.onMetricsUpdateCb(this.getMetrics());
    }
  }

  // --------------------------------------------------------------------------
  // Particle System
  // --------------------------------------------------------------------------
  private spawnRunParticle() {
    const isAngel = this.faction === 'ANGEL';
    const color = isAngel
      ? (['#38bdf8', '#fef08a', '#ffffff'][Math.floor(Math.random() * 3)])
      : (['#ef4444', '#f97316', '#7f1d1d'][Math.floor(Math.random() * 3)]);

    const footY = this.player.currentPlatform ? this.player.currentPlatform.y - 4 : this.GROUND_Y - 4;
    this.particles.push({
      x: this.player.x + 10,
      y: footY,
      vx: -(Math.random() * 140 + 90),
      vy: -(Math.random() * 40 + 10),
      size: Math.random() * 4 + 2,
      color,
      alpha: 0.8,
      life: 0,
      maxLife: 0.35,
    });
  }

  private spawnJumpParticles() {
    const footY = this.player.currentPlatform ? this.player.currentPlatform.y - 2 : this.GROUND_Y - 2;
    for (let i = 0; i < 9; i++) {
      this.particles.push({
        x: this.player.x + 24,
        y: footY,
        vx: (Math.random() - 0.6) * 170,
        vy: -(Math.random() * 100 + 30),
        size: Math.random() * 5 + 3,
        color: this.faction === 'ANGEL' ? '#67e8f9' : '#f87171',
        alpha: 0.9,
        life: 0,
        maxLife: 0.45,
      });
    }
  }

  private spawnLandingParticles() {
    const footY = this.player.currentPlatform ? this.player.currentPlatform.y - 2 : this.GROUND_Y - 2;
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: this.player.x + 24,
        y: footY,
        vx: (Math.random() - 0.5) * 190,
        vy: -Math.random() * 45,
        size: Math.random() * 4 + 2,
        color: this.faction === 'ANGEL' ? '#fde047' : '#ea580c',
        alpha: 0.8,
        life: 0,
        maxLife: 0.3,
      });
    }
  }

  private spawnSlideParticles() {
    const footY = this.player.currentPlatform ? this.player.currentPlatform.y - 2 : this.GROUND_Y - 2;
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        x: this.player.x + 52,
        y: footY,
        vx: -(Math.random() * 240 + 120),
        vy: -(Math.random() * 35),
        size: Math.random() * 5 + 2,
        color: this.faction === 'ANGEL' ? '#38bdf8' : '#dc2626',
        alpha: 0.9,
        life: 0,
        maxLife: 0.4,
      });
    }
  }

  private spawnChipParticles(x: number, y: number) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = Math.random() * 130 + 70;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 3,
        color: ['#facc15', '#38bdf8', '#ef4444', '#fef08a'][i % 4],
        alpha: 1,
        life: 0,
        maxLife: 0.5,
      });
    }
  }

  private spawnImpactParticles(x: number, y: number) {
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2;
      const speed = Math.random() * 280 + 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        size: Math.random() * 7 + 4,
        color: ['#ef4444', '#f59e0b', '#ffffff', '#7f1d1d'][i % 4],
        alpha: 1,
        life: 0,
        maxLife: 0.7,
      });
    }
  }

  private spawnDeathExplosionParticles(x: number, y: number) {
    const colors = this.faction === 'ANGEL'
      ? ['#ffffff', '#fde047', '#38bdf8', '#f97316', '#fef08a']
      : ['#ffffff', '#ef4444', '#f97316', '#7f1d1d', '#facc15'];
    for (let i = 0; i < 72; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 620 + 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        size: Math.random() * 13 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife: 0.58,
      });
    }
  }

  private spawnDebrisShatterParticles(x: number, y: number, _obsType?: string) {
    const isAngel = this.faction === 'ANGEL';
    const colors = isAngel
      ? ['#38bdf8', '#facc15', '#ffffff', '#0284c7', '#fde047']
      : ['#ef4444', '#f97316', '#7f1d1d', '#ffedd5', '#b91c1c'];

    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 380 + 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        size: Math.random() * 7 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife: 0.65,
      });
    }
  }

  private spawnFeverTrailParticles() {
    const isAngel = this.faction === 'ANGEL';
    const color = isAngel
      ? ['#38bdf8', '#fef08a', '#ffffff'][Math.floor(Math.random() * 3)]
      : ['#ef4444', '#f97316', '#fbbf24'][Math.floor(Math.random() * 3)];

    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: this.player.x + 10 - Math.random() * 20,
        y: this.player.y + 15 + Math.random() * 40,
        vx: -(Math.random() * 280 + 150),
        vy: (Math.random() - 0.5) * 80,
        size: Math.random() * 6 + 3,
        color,
        alpha: 0.95,
        life: 0,
        maxLife: 0.35,
      });
    }
  }

  private spawnFeverCollectParticles(x: number, y: number) {
    const isAngel = this.faction === 'ANGEL';
    const colors = isAngel ? ['#38bdf8', '#fde047', '#ffffff'] : ['#ef4444', '#f97316', '#ffedd5'];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = Math.random() * 190 + 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 6 + 3,
        color: colors[i % colors.length],
        alpha: 1,
        life: 0,
        maxLife: 0.6,
      });
    }
  }

  private addFloatText(text: string, x: number, y: number, color: string) {
    this.floatTexts.push({
      text,
      x,
      y,
      color,
      alpha: 1,
      life: 0,
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = 1 - p.life / p.maxLife;
    }
  }

  private updateFloatTexts(dt: number) {
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.life += dt;
      ft.y -= 30 * dt;
      ft.alpha = Math.max(0, 1 - ft.life / 0.8);
      if (ft.life >= 0.8) {
        this.floatTexts.splice(i, 1);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  private render() {
    this.ctx.save();

    if (this.screenShakeTime > 0) {
      const shakeMag = this.screenShakeTime * (this.state === 'GAMEOVER' ? 80 : 15);
      const ox = (Math.random() - 0.5) * shakeMag;
      const oy = (Math.random() - 0.5) * shakeMag;
      this.ctx.translate(ox, oy);
    }

    // 1. Sky & Parallax
    this.drawSkyBackground();
    this.drawParallaxScenery();
    this.drawGround();

    // 2. Platforms (NEW)
    this.drawPlatforms();

    // 3. Obstacles (including Sudden Droppers)
    this.drawObstacles();

    // 4. Chips
    this.drawChips();

    // 5. Particles
    this.drawParticles();
    this.drawDeathExplosion();

    // 6. Player (the character vanishes into the blast on death)
    if (this.state !== 'GAMEOVER') this.drawPlayer();

    // 7. Floating Numbers
    this.drawFloatTexts();

    // 8. Fever Screen Edge Light/Flame Effects & Timer HUD
    this.drawFeverBorderEffects();

    // 9. State Overlays
    this.drawStateOverlays();

    this.ctx.restore();
  }

  private drawSkyBackground() {
    const isAngel = this.faction === 'ANGEL';
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.GROUND_Y);

    if (isAngel) {
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(0.55, '#38bdf8');
      grad.addColorStop(1, '#fef08a');
    } else {
      grad.addColorStop(0, '#1c0508');
      grad.addColorStop(0.5, '#450a0a');
      grad.addColorStop(1, '#991b1b');
    }

    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.V_WIDTH, this.V_HEIGHT);
  }

  private drawParallaxScenery() {
    const isAngel = this.faction === 'ANGEL';
    this.ctx.fillStyle = isAngel ? 'rgba(255, 255, 255, 0.25)' : 'rgba(20, 0, 10, 0.45)';
    this.drawSilhouettes(this.backgroundScroll1, 160, 140, isAngel);

    this.ctx.fillStyle = isAngel ? 'rgba(254, 240, 138, 0.35)' : 'rgba(153, 27, 27, 0.35)';
    this.drawSilhouettes(this.backgroundScroll2, 240, 90, isAngel);
  }

  private drawSilhouettes(scroll: number, yBase: number, height: number, isAngel: boolean) {
    this.ctx.save();
    const period = 320;
    const startX = -(scroll % period);

    for (let x = startX - period; x < this.V_WIDTH + period; x += period) {
      this.ctx.beginPath();
      if (isAngel) {
        this.ctx.moveTo(x, yBase);
        this.ctx.bezierCurveTo(x + 60, yBase - height, x + 160, yBase - height * 1.2, x + 240, yBase - height * 0.4);
        this.ctx.bezierCurveTo(x + 280, yBase - height * 0.2, x + 300, yBase, x + period, yBase);
        this.ctx.lineTo(x + period, this.GROUND_Y);
        this.ctx.lineTo(x, this.GROUND_Y);
      } else {
        this.ctx.moveTo(x, yBase);
        this.ctx.lineTo(x + 80, yBase - height * 1.3);
        this.ctx.lineTo(x + 140, yBase - height * 0.6);
        this.ctx.lineTo(x + 210, yBase - height * 1.1);
        this.ctx.lineTo(x + 270, yBase - height * 0.3);
        this.ctx.lineTo(x + period, yBase);
        this.ctx.lineTo(x + period, this.GROUND_Y);
        this.ctx.lineTo(x, this.GROUND_Y);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawGround() {
    const isAngel = this.faction === 'ANGEL';
    const groundHeight = this.V_HEIGHT - this.GROUND_Y;

    const gGrad = this.ctx.createLinearGradient(0, this.GROUND_Y, 0, this.V_HEIGHT);
    if (isAngel) {
      gGrad.addColorStop(0, '#f8fafc');
      gGrad.addColorStop(0.15, '#e2e8f0');
      gGrad.addColorStop(1, '#94a3b8');
    } else {
      gGrad.addColorStop(0, '#270808');
      gGrad.addColorStop(0.2, '#180404');
      gGrad.addColorStop(1, '#080101');
    }
    this.ctx.fillStyle = gGrad;
    this.ctx.fillRect(0, this.GROUND_Y, this.V_WIDTH, groundHeight);

    this.ctx.fillStyle = isAngel ? '#facc15' : '#ef4444';
    this.ctx.fillRect(0, this.GROUND_Y, this.V_WIDTH, 5);

    this.ctx.strokeStyle = isAngel ? 'rgba(217, 119, 6, 0.4)' : 'rgba(239, 68, 68, 0.4)';
    this.ctx.lineWidth = 2;
    for (let x = -this.groundScroll; x < this.V_WIDTH; x += 60) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, this.GROUND_Y + 5);
      this.ctx.lineTo(x - 20, this.V_HEIGHT);
      this.ctx.stroke();
    }
  }

  /**
   * NEW: DRAW FLOATING STEPPING PLATFORMS
   */
  private drawPlatforms() {
    const isAngel = this.faction === 'ANGEL';

    for (const plat of this.platforms) {
      this.ctx.save();
      this.ctx.translate(plat.x, plat.y);

      // Floating shadow/cloud underneath
      this.ctx.fillStyle = isAngel ? 'rgba(56, 189, 248, 0.25)' : 'rgba(239, 68, 68, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(plat.width / 2, plat.height + 6, plat.width * 0.52, 6, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Platform Stone Slab
      const platGrad = this.ctx.createLinearGradient(0, 0, 0, plat.height);
      if (isAngel) {
        platGrad.addColorStop(0, '#ffffff'); // Polished white marble
        platGrad.addColorStop(0.3, '#f1f5f9');
        platGrad.addColorStop(1, '#cbd5e1');
      } else {
        platGrad.addColorStop(0, '#450a0a'); // Volcanic basalt
        platGrad.addColorStop(0.3, '#262626');
        platGrad.addColorStop(1, '#171717');
      }
      this.ctx.fillStyle = platGrad;
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2.5;

      // Rounded rectangle slab
      const r = 6;
      this.ctx.beginPath();
      this.ctx.moveTo(r, 0);
      this.ctx.lineTo(plat.width - r, 0);
      this.ctx.quadraticCurveTo(plat.width, 0, plat.width, r);
      this.ctx.lineTo(plat.width, plat.height - r);
      this.ctx.quadraticCurveTo(plat.width, plat.height, plat.width - r, plat.height);
      this.ctx.lineTo(r, plat.height);
      this.ctx.quadraticCurveTo(0, plat.height, 0, plat.height - r);
      this.ctx.lineTo(0, r);
      this.ctx.quadraticCurveTo(0, 0, r, 0);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // Top glowing landing strip
      this.ctx.fillStyle = isAngel ? '#fde047' : '#ef4444';
      this.ctx.fillRect(2, 1, plat.width - 4, 3);

      // Embedded crystal studs
      this.ctx.fillStyle = isAngel ? '#38bdf8' : '#f97316';
      for (let cx = 18; cx < plat.width - 10; cx += 32) {
        this.ctx.beginPath();
        this.ctx.arc(cx, plat.height / 2 + 1, 3.5, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }
  }

  /**
   * DISTINCT ARCADE OBSTACLES:
   * 1. BOX (Crate)
   * 2. SPIKE (Crystals)
   * 3. AERIAL (Winged Gargoyle)
   * 4. CEILING (Guillotine Gate)
   * 5. DROPPER (NEW: Sudden Descending Slammer)
   */
  private drawObstacles() {
    const isAngel = this.faction === 'ANGEL';

    for (const obs of this.obstacles) {
      this.ctx.save();
      this.ctx.translate(obs.x, obs.y);

      switch (obs.type) {
        // -------------------------------------------------------------
        // 1. CRATE / ALTAR BOX
        // -------------------------------------------------------------
        case 'BOX': {
          const w = obs.width;
          const h = obs.height;

          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          this.ctx.beginPath();
          this.ctx.ellipse(w / 2, h + 2, w * 0.55, 6, 0, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.fillStyle = isAngel ? '#fef08a' : '#991b1b';
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.moveTo(0, 6);
          this.ctx.lineTo(6, 0);
          this.ctx.lineTo(w, 0);
          this.ctx.lineTo(w, 6);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();

          const boxGrad = this.ctx.createLinearGradient(0, 6, 0, h);
          if (isAngel) {
            boxGrad.addColorStop(0, '#fef9c3');
            boxGrad.addColorStop(1, '#fde047');
          } else {
            boxGrad.addColorStop(0, '#7f1d1d');
            boxGrad.addColorStop(1, '#450a0a');
          }
          this.ctx.fillStyle = boxGrad;
          this.ctx.fillRect(0, 6, w, h - 6);
          this.ctx.strokeRect(0, 6, w, h - 6);

          this.ctx.strokeStyle = isAngel ? '#ca8a04' : '#ef4444';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.moveTo(4, 10);
          this.ctx.lineTo(w - 4, h - 4);
          this.ctx.moveTo(w - 4, 10);
          this.ctx.lineTo(4, h - 4);
          this.ctx.stroke();

          const cornerSize = 10;
          this.ctx.fillStyle = isAngel ? '#0284c7' : '#1e1b4b';
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 1.5;
          this.ctx.fillRect(0, 6, cornerSize, cornerSize);
          this.ctx.strokeRect(0, 6, cornerSize, cornerSize);
          this.ctx.fillRect(w - cornerSize, 6, cornerSize, cornerSize);
          this.ctx.strokeRect(w - cornerSize, 6, cornerSize, cornerSize);
          this.ctx.fillRect(0, h - cornerSize, cornerSize, cornerSize);
          this.ctx.strokeRect(0, h - cornerSize, cornerSize, cornerSize);
          this.ctx.fillRect(w - cornerSize, h - cornerSize, cornerSize, cornerSize);
          this.ctx.strokeRect(w - cornerSize, h - cornerSize, cornerSize, cornerSize);

          this.ctx.fillStyle = isAngel ? '#38bdf8' : '#f97316';
          this.ctx.beginPath();
          this.ctx.arc(w / 2, h / 2 + 3, 7, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();
          break;
        }

        // -------------------------------------------------------------
        // 2. GROUND SPIKES (CARTOON FACETED CRYSTAL & VOLCANIC OBSIDIAN SHARDS)
        // -------------------------------------------------------------
        case 'SPIKE': {
          const w = obs.width;
          const h = obs.height;
          const time = Date.now() * 0.005;

          // 1. Stylized Ground Cracks & Impact Glow
          this.ctx.save();
          // Ground hazard shadow & inner energy glow
          this.ctx.fillStyle = isAngel ? 'rgba(56, 189, 248, 0.28)' : 'rgba(239, 68, 68, 0.35)';
          this.ctx.beginPath();
          this.ctx.ellipse(w / 2, h + 3, w * 0.62, 7, 0, 0, Math.PI * 2);
          this.ctx.fill();

          // Jagged ground fracture lines
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 2.5;
          this.ctx.lineCap = 'round';
          this.ctx.beginPath();
          this.ctx.moveTo(-6, h + 1);
          this.ctx.lineTo(w * 0.2, h + 4);
          this.ctx.lineTo(w * 0.45, h + 2);
          this.ctx.lineTo(w * 0.8, h + 5);
          this.ctx.lineTo(w + 8, h + 1);
          this.ctx.stroke();

          // Glowing fracture fissure
          this.ctx.strokeStyle = isAngel ? '#38bdf8' : '#f97316';
          this.ctx.lineWidth = 1.8;
          this.ctx.beginPath();
          this.ctx.moveTo(-4, h + 1);
          this.ctx.lineTo(w * 0.2, h + 3);
          this.ctx.lineTo(w * 0.45, h + 1);
          this.ctx.lineTo(w * 0.8, h + 4);
          this.ctx.lineTo(w + 6, h + 1);
          this.ctx.stroke();

          this.ctx.restore();

          // 2. Multi-Spike Faceted Cluster (Left, Right, Center)
          this.ctx.save();
          this.ctx.lineJoin = 'round';

          // Helper to draw faceted cartoon spike
          const drawFacetedSpike = (
            baseX1: number,
            baseX2: number,
            baseY: number,
            tipX: number,
            tipY: number,
            scaleFactor = 1
          ) => {
            const midBaseX = (baseX1 + baseX2) / 2;

            // Outer Comic Black Silhouette Outline
            this.ctx.beginPath();
            this.ctx.moveTo(baseX1, baseY);
            this.ctx.lineTo(tipX, tipY);
            this.ctx.lineTo(baseX2, baseY);
            this.ctx.closePath();
            this.ctx.fillStyle = '#000000';
            this.ctx.lineWidth = 3.5;
            this.ctx.strokeStyle = '#000000';
            this.ctx.stroke();
            this.ctx.fill();

            // Left Facet (Light/Highlight side)
            const leftGrad = this.ctx.createLinearGradient(baseX1, tipY, tipX, baseY);
            if (isAngel) {
              leftGrad.addColorStop(0, '#ffffff');
              leftGrad.addColorStop(0.35, '#bae6fd');
              leftGrad.addColorStop(1, '#38bdf8');
            } else {
              leftGrad.addColorStop(0, '#ffedd5');
              leftGrad.addColorStop(0.3, '#f97316');
              leftGrad.addColorStop(1, '#b91c1c');
            }
            this.ctx.fillStyle = leftGrad;
            this.ctx.beginPath();
            this.ctx.moveTo(baseX1 + 1.5, baseY - 1);
            this.ctx.lineTo(tipX, tipY + 1.5);
            this.ctx.lineTo(midBaseX, baseY - 1);
            this.ctx.closePath();
            this.ctx.fill();

            // Right Facet (Shaded side)
            const rightGrad = this.ctx.createLinearGradient(midBaseX, tipY, baseX2, baseY);
            if (isAngel) {
              rightGrad.addColorStop(0, '#7dd3fc');
              rightGrad.addColorStop(0.5, '#0284c7');
              rightGrad.addColorStop(1, '#0369a1');
            } else {
              rightGrad.addColorStop(0, '#ef4444');
              rightGrad.addColorStop(0.5, '#7f1d1d');
              rightGrad.addColorStop(1, '#450a0a');
            }
            this.ctx.fillStyle = rightGrad;
            this.ctx.beginPath();
            this.ctx.moveTo(midBaseX, baseY - 1);
            this.ctx.lineTo(tipX, tipY + 1.5);
            this.ctx.lineTo(baseX2 - 1.5, baseY - 1);
            this.ctx.closePath();
            this.ctx.fill();

            // Central Ridge Specular Gleam
            this.ctx.strokeStyle = isAngel ? '#ffffff' : '#fbbf24';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(midBaseX, baseY - 3);
            this.ctx.lineTo(tipX, tipY + 3);
            this.ctx.stroke();

            // Magma vein fissure for devil
            if (!isAngel) {
              this.ctx.strokeStyle = '#fef08a';
              this.ctx.lineWidth = 1.2;
              this.ctx.beginPath();
              this.ctx.moveTo(tipX, tipY + 6);
              this.ctx.lineTo(midBaseX - 3, baseY * 0.65);
              this.ctx.lineTo(midBaseX + 2, baseY - 4);
              this.ctx.stroke();
            }
          };

          // Left sub-spike
          drawFacetedSpike(1, w * 0.46, h, w * 0.22, 10, 0.85);

          // Right sub-spike
          drawFacetedSpike(w * 0.52, w - 1, h, w * 0.76, 12, 0.8);

          // Center Main Tall Spike (Dominant)
          drawFacetedSpike(w * 0.22, w * 0.8, h, w * 0.51, 1, 1.0);

          // Animated Tip Sparkle / Glint on the Main Apex
          const sparklePhase = Math.sin(time * 3);
          if (sparklePhase > 0.2) {
            const sparkleSize = 3 + sparklePhase * 3.5;
            const tipX = w * 0.51;
            const tipY = 2;

            this.ctx.fillStyle = isAngel ? '#ffffff' : '#fef08a';
            this.ctx.strokeStyle = isAngel ? '#38bdf8' : '#ef4444';
            this.ctx.lineWidth = 1;

            // 4-pointed diamond star
            this.ctx.beginPath();
            this.ctx.moveTo(tipX, tipY - sparkleSize);
            this.ctx.lineTo(tipX + sparkleSize * 0.45, tipY);
            this.ctx.lineTo(tipX, tipY + sparkleSize);
            this.ctx.lineTo(tipX - sparkleSize * 0.45, tipY);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            // Cross gleam lines
            this.ctx.beginPath();
            this.ctx.moveTo(tipX - sparkleSize * 1.3, tipY);
            this.ctx.lineTo(tipX + sparkleSize * 1.3, tipY);
            this.ctx.moveTo(tipX, tipY - sparkleSize * 1.3);
            this.ctx.lineTo(tipX, tipY + sparkleSize * 1.3);
            this.ctx.stroke();
          }

          this.ctx.restore();
          break;
        }

        // -------------------------------------------------------------
        // 3. AERIAL FLYING HAZARD
        // -------------------------------------------------------------
        case 'AERIAL': {
          const time = Date.now() * 0.008;
          const wingFlap = Math.sin(time * 2.5) * 8;
          const hoverY = Math.sin(time) * 4;

          this.ctx.translate(0, hoverY);
          const w = obs.width;
          const h = obs.height;

          this.ctx.fillStyle = isAngel ? '#bae6fd' : '#450a0a';
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 2.5;

          this.ctx.beginPath();
          this.ctx.moveTo(w * 0.35, h * 0.45);
          this.ctx.quadraticCurveTo(0, h * 0.1 - wingFlap, -8, h * 0.6);
          this.ctx.lineTo(w * 0.35, h * 0.65);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.beginPath();
          this.ctx.moveTo(w * 0.65, h * 0.45);
          this.ctx.quadraticCurveTo(w, h * 0.1 - wingFlap, w + 8, h * 0.6);
          this.ctx.lineTo(w * 0.65, h * 0.65);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();

          const bodyGrad = this.ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * 0.35);
          bodyGrad.addColorStop(0, isAngel ? '#fef08a' : '#ef4444');
          bodyGrad.addColorStop(1, isAngel ? '#0284c7' : '#7f1d1d');
          this.ctx.fillStyle = bodyGrad;
          this.ctx.beginPath();
          this.ctx.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = '#ffffff';
          this.ctx.beginPath();
          this.ctx.arc(w / 2 + 2, h / 2 - 2, 5, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.fillStyle = '#000000';
          this.ctx.beginPath();
          this.ctx.arc(w / 2 + 3, h / 2 - 2, 2.5, 0, Math.PI * 2);
          this.ctx.fill();
          break;
        }

        // -------------------------------------------------------------
        // 4. LOW CEILING
        // -------------------------------------------------------------
        case 'CEILING': {
          const w = obs.width;
          const h = obs.height;

          this.ctx.strokeStyle = '#64748b';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.moveTo(w * 0.25, 0);
          this.ctx.lineTo(w * 0.25, 20);
          this.ctx.moveTo(w * 0.75, 0);
          this.ctx.lineTo(w * 0.75, 20);
          this.ctx.stroke();

          const gateGrad = this.ctx.createLinearGradient(0, 0, 0, h);
          gateGrad.addColorStop(0, isAngel ? '#cbd5e1' : '#1e1b4b');
          gateGrad.addColorStop(1, isAngel ? '#94a3b8' : '#0f172a');
          this.ctx.fillStyle = gateGrad;
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 3;
          this.ctx.fillRect(0, 0, w, h - 16);
          this.ctx.strokeRect(0, 0, w, h - 16);

          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.rect(0, h - 36, w, 20);
          this.ctx.clip();
          this.ctx.fillStyle = isAngel ? '#facc15' : '#ef4444';
          for (let sx = -20; sx < w + 20; sx += 18) {
            this.ctx.beginPath();
            this.ctx.moveTo(sx, h - 16);
            this.ctx.lineTo(sx + 10, h - 36);
            this.ctx.lineTo(sx + 18, h - 36);
            this.ctx.lineTo(sx + 8, h - 16);
            this.ctx.closePath();
            this.ctx.fill();
          }
          this.ctx.restore();

          const teeth = 5;
          const toothW = w / teeth;
          this.ctx.fillStyle = isAngel ? '#fde047' : '#dc2626';
          for (let i = 0; i < teeth; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * toothW, h - 16);
            this.ctx.lineTo((i + 0.5) * toothW, h);
            this.ctx.lineTo((i + 1) * toothW, h - 16);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
          }
          break;
        }

        // -------------------------------------------------------------
        // 5. NEW: SUDDEN DESCENDING CRUSHER (DROPPER)
        // -------------------------------------------------------------
        case 'DROPPER': {
          const w = obs.width;
          const h = obs.height;

          // Overhead Warning Beacon when waiting or dropping
          if (obs.dropState !== 'LANDED') {
            const pulse = Math.sin(obs.warningPhase || 0);
            this.ctx.save();
            // Downward laser guide beam
            this.ctx.fillStyle = isAngel
              ? `rgba(250, 204, 21, ${0.15 + pulse * 0.1})`
              : `rgba(239, 68, 68, ${0.15 + pulse * 0.1})`;
            this.ctx.fillRect(w / 2 - 3, -obs.y, 6, this.GROUND_Y);

            // Warning icon at top of screen
            this.ctx.font = '900 18px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = isAngel ? '#facc15' : '#ef4444';
            this.ctx.fillText('⚠️', w / 2, -obs.y + 36);
            this.ctx.restore();
          }

          // Main Heavy Monolith / Crusher Block
          const dropGrad = this.ctx.createLinearGradient(0, 0, 0, h);
          if (isAngel) {
            dropGrad.addColorStop(0, '#fef08a'); // Celestial Golden Anvil
            dropGrad.addColorStop(1, '#ca8a04');
          } else {
            dropGrad.addColorStop(0, '#ef4444'); // Demonic Meteor Spire
            dropGrad.addColorStop(1, '#450a0a');
          }

          this.ctx.fillStyle = dropGrad;
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 3;
          this.ctx.fillRect(0, 0, w, h);
          this.ctx.strokeRect(0, 0, w, h);

          // Danger Warning Cross & Spike Teeth at Bottom
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(6, 6);
          this.ctx.lineTo(w - 6, h - 6);
          this.ctx.moveTo(w - 6, 6);
          this.ctx.lineTo(6, h - 6);
          this.ctx.stroke();

          // Spikes at bottom
          this.ctx.fillStyle = '#000000';
          for (let si = 0; si < 3; si++) {
            this.ctx.beginPath();
            this.ctx.moveTo(si * (w / 3), h);
            this.ctx.lineTo((si + 0.5) * (w / 3), h + 6);
            this.ctx.lineTo((si + 1) * (w / 3), h);
            this.ctx.closePath();
            this.ctx.fill();
          }
          break;
        }

        // -------------------------------------------------------------
        // 6. RISING ERUPTING OBSTACLE (SURGE)
        // -------------------------------------------------------------
        case 'HOPPER': {
          const w = obs.width;
          const h = obs.height;
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          this.ctx.beginPath();
          this.ctx.ellipse(w / 2, h + 4, w * 0.55, 6, 0, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.fillStyle = isAngel ? '#38bdf8' : '#ef4444';
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.moveTo(2, h);
          this.ctx.lineTo(w * 0.28, h * 0.46);
          this.ctx.lineTo(w * 0.38, h * 0.62);
          this.ctx.lineTo(w * 0.62, 2);
          this.ctx.lineTo(w * 0.72, h * 0.62);
          this.ctx.lineTo(w - 2, h);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.strokeStyle = isAngel ? '#fef08a' : '#fbbf24';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(w * 0.5, h - 3);
          this.ctx.lineTo(w * 0.62, 6);
          this.ctx.stroke();
          break;
        }
        case 'BOBBING_ORB': {
          const w = obs.width;
          const h = obs.height;
          const pulse = Math.sin(Date.now() * 0.008) * 3;
          const orb = this.ctx.createRadialGradient(w * 0.35, h * 0.3, 2, w / 2, h / 2, w * 0.58);
          orb.addColorStop(0, '#ffffff');
          orb.addColorStop(0.35, isAngel ? '#38bdf8' : '#f97316');
          orb.addColorStop(1, isAngel ? '#1d4ed8' : '#7f1d1d');
          this.ctx.shadowColor = isAngel ? '#38bdf8' : '#ef4444';
          this.ctx.shadowBlur = 18;
          this.ctx.fillStyle = orb;
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.arc(w / 2, h / 2, w * 0.4 + pulse, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;
          this.ctx.strokeStyle = isAngel ? '#fef08a' : '#ffedd5';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.ellipse(w / 2, h / 2, w * 0.52, h * 0.2, Date.now() * 0.002, 0, Math.PI * 2);
          this.ctx.stroke();
          break;
        }
        case 'LIFTING_GATE': {
          const w = obs.width;
          const h = obs.height;
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          this.ctx.fillRect(8, h - 8, w - 16, 12);
          const gate = this.ctx.createLinearGradient(0, 0, 0, h);
          gate.addColorStop(0, isAngel ? '#fef08a' : '#f97316');
          gate.addColorStop(0.5, isAngel ? '#38bdf8' : '#ef4444');
          gate.addColorStop(1, isAngel ? '#0369a1' : '#7f1d1d');
          this.ctx.fillStyle = gate;
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 3;
          this.ctx.fillRect(8, 8, w - 16, h - 16);
          this.ctx.strokeRect(8, 8, w - 16, h - 16);
          this.ctx.fillStyle = '#facc15';
          for (let sx = 12; sx < w - 12; sx += 22) {
            this.ctx.beginPath();
            this.ctx.moveTo(sx, h - 10);
            this.ctx.lineTo(sx + 10, h - 10);
            this.ctx.lineTo(sx + 20, h - 24);
            this.ctx.lineTo(sx + 10, h - 24);
            this.ctx.closePath();
            this.ctx.fill();
          }
          this.ctx.strokeStyle = isAngel ? '#ffffff' : '#fecaca';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.moveTo(20, 0);
          this.ctx.lineTo(20, 8);
          this.ctx.moveTo(w - 20, 0);
          this.ctx.lineTo(w - 20, 8);
          this.ctx.stroke();
          break;
        }
        case 'SURGE': {
          const w = obs.width;
          const h = obs.height;

          // Ground Fissure & Warning Indicator
          if (obs.surgeState === 'WARNING' || obs.surgeState === 'DORMANT') {
            const pulse = Math.sin(obs.warningPhase || 0);
            this.ctx.save();
            // Fissure glow on ground
            this.ctx.fillStyle = isAngel
              ? `rgba(250, 204, 21, ${0.45 + pulse * 0.3})`
              : `rgba(239, 68, 68, ${0.45 + pulse * 0.3})`;
            this.ctx.beginPath();
            this.ctx.ellipse(w / 2, h + 2, w * 0.65, 8, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Upward warning indicator
            this.ctx.font = '900 18px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = isAngel ? '#facc15' : '#ef4444';
            this.ctx.fillText('⬆️', w / 2, h - 8 - pulse * 4);
            this.ctx.restore();
          }

          // If still underground and not erupting/peak, don't draw main body
          if (obs.surgeState === 'DORMANT') {
            break;
          }

          // Rising Spire Body
          this.ctx.save();
          // Ground crack shadow ring at base
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          this.ctx.beginPath();
          this.ctx.ellipse(w / 2, h + 3, w * 0.6, 6, 0, 0, Math.PI * 2);
          this.ctx.fill();

          // Spire gradient
          const surgeGrad = this.ctx.createLinearGradient(0, 0, 0, h);
          if (isAngel) {
            surgeGrad.addColorStop(0, '#ffffff'); // Radiant holy light crystal
            surgeGrad.addColorStop(0.3, '#38bdf8');
            surgeGrad.addColorStop(0.8, '#fde047');
            surgeGrad.addColorStop(1, '#ca8a04');
          } else {
            surgeGrad.addColorStop(0, '#ffedd5'); // Scorching volcanic obsidian
            surgeGrad.addColorStop(0.2, '#ef4444');
            surgeGrad.addColorStop(0.7, '#7f1d1d');
            surgeGrad.addColorStop(1, '#171717');
          }
          this.ctx.fillStyle = surgeGrad;
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 2.5;

          // Cartoon Jagged Erupting Spire Shape
          this.ctx.beginPath();
          this.ctx.moveTo(w * 0.1, h);
          this.ctx.lineTo(w * 0.18, h * 0.55);
          this.ctx.lineTo(w * 0.05, h * 0.52);
          this.ctx.lineTo(w * 0.5, 0); // Sharp erupting peak!
          this.ctx.lineTo(w * 0.95, h * 0.52);
          this.ctx.lineTo(w * 0.82, h * 0.55);
          this.ctx.lineTo(w * 0.9, h);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();

          // Internal crystal facets & glowing fissures
          this.ctx.strokeStyle = isAngel ? '#ffffff' : '#fbbf24';
          this.ctx.lineWidth = 1.8;
          this.ctx.beginPath();
          this.ctx.moveTo(w * 0.5, 0);
          this.ctx.lineTo(w * 0.45, h * 0.65);
          this.ctx.lineTo(w * 0.5, h);
          this.ctx.moveTo(w * 0.5, 0);
          this.ctx.lineTo(w * 0.7, h * 0.6);
          this.ctx.stroke();

          // Glowing energy particles around peak if fully erupted
          if (obs.surgeState === 'PEAK') {
            this.ctx.fillStyle = isAngel ? '#fef08a' : '#f97316';
            this.ctx.beginPath();
            this.ctx.arc(w * 0.5, -4, 4, 0, Math.PI * 2);
            this.ctx.fill();
          }

          this.ctx.restore();
          break;
        }
      }
      this.ctx.restore();
    }
  }

  private drawChips() {
    const isAngel = this.faction === 'ANGEL';

    for (const chip of this.chips) {
      if (chip.collected) continue;

      const bobY = Math.sin(chip.bobPhase) * 5;
      const drawX = chip.x;
      const drawY = chip.y + bobY;

      this.ctx.save();

      if (chip.type === 'FEVER') {
        // -------------------------------------------------------------
        // FEVER ORB (Gleaming Astral Star with Spinning Aura)
        // -------------------------------------------------------------
        const time = Date.now() * 0.005;
        const rot = time * 2.2;
        const pulse = Math.sin(time * 4) * 3;
        const cx = drawX + chip.width / 2;
        const cy = drawY + chip.height / 2;

        this.ctx.translate(cx, cy);

        // Radiant Outer Aura
        this.ctx.shadowColor = isAngel ? '#38bdf8' : '#ef4444';
        this.ctx.shadowBlur = 18;

        // Spinning Energy Ring
        this.ctx.strokeStyle = isAngel ? 'rgba(56, 189, 248, 0.85)' : 'rgba(239, 68, 68, 0.85)';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, chip.width * 0.52 + pulse, 0, Math.PI * 2);
        this.ctx.stroke();

        // 8-Point Sparkling Star
        this.ctx.rotate(rot);
        const starGrad = this.ctx.createRadialGradient(0, 0, 2, 0, 0, chip.width * 0.5);
        if (isAngel) {
          starGrad.addColorStop(0, '#ffffff');
          starGrad.addColorStop(0.4, '#fde047');
          starGrad.addColorStop(1, '#0284c7');
        } else {
          starGrad.addColorStop(0, '#ffffff');
          starGrad.addColorStop(0.4, '#f97316');
          starGrad.addColorStop(1, '#b91c1c');
        }

        this.ctx.fillStyle = starGrad;
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1.5;

        // Draw 8-pointed star
        this.ctx.beginPath();
        for (let s = 0; s < 8; s++) {
          const a = (s * Math.PI) / 4;
          const r1 = chip.width * 0.48;
          const r2 = chip.width * 0.22;
          const px = Math.cos(a) * r1;
          const py = Math.sin(a) * r1;
          const midA = a + Math.PI / 8;
          const mx = Math.cos(midA) * r2;
          const my = Math.sin(midA) * r2;
          if (s === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
          this.ctx.lineTo(mx, my);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Glowing center core
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        // Standard Event Chip
        this.ctx.shadowColor = '#facc15';
        this.ctx.shadowBlur = 10;

        if (this.isAssetsLoaded && this.chipImg.complete && this.chipImg.naturalWidth > 0) {
          this.ctx.drawImage(this.chipImg, drawX, drawY, chip.width, chip.height);
        } else {
          this.ctx.fillStyle = '#facc15';
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(drawX + chip.width / 2, drawY + chip.height / 2, chip.width / 2, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();
        }
      }

      this.ctx.restore();
    }
  }

  private drawDeathExplosion() {
    if (this.deathExplosionTime <= 0) return;
    const progress = 1 - this.deathExplosionTime / 0.58;
    const alpha = Math.max(0, 1 - progress);
    const radius = 24 + progress * 180;
    const x = this.deathExplosionX;
    const y = this.deathExplosionY;

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    const flash = this.ctx.createRadialGradient(x, y, 2, x, y, radius);
    flash.addColorStop(0, '#ffffff');
    flash.addColorStop(0.22, this.faction === 'ANGEL' ? '#fde047' : '#f97316');
    flash.addColorStop(1, 'rgba(239, 68, 68, 0)');
    this.ctx.fillStyle = flash;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = this.faction === 'ANGEL' ? '#fff7ae' : '#ff5538';
    this.ctx.lineWidth = 12 * (1 - progress) + 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * 0.78, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.translate(x, y - 8);
    this.ctx.rotate(-0.08 + progress * 0.16);
    this.ctx.beginPath();
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const spikeRadius = i % 2 === 0 ? 76 : 43;
      const px = Math.cos(angle) * spikeRadius;
      const py = Math.sin(angle) * spikeRadius;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = this.faction === 'ANGEL' ? '#facc15' : '#ef4444';
    this.ctx.strokeStyle = '#080808';
    this.ctx.lineWidth = 7;
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawParticles() {
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  private drawFloatTexts() {
    this.ctx.save();
    this.ctx.font = '900 18px "Noto Sans KR", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = '#000000';

    for (const ft of this.floatTexts) {
      this.ctx.globalAlpha = ft.alpha;
      this.ctx.fillStyle = ft.color;
      this.ctx.strokeText(ft.text, ft.x, ft.y);
      this.ctx.fillText(ft.text, ft.x, ft.y);
    }
    this.ctx.restore();
  }

  private drawPlayer() {
    const isSliding = this.player.isSliding && this.player.isGrounded;
    const isAngel = this.faction === 'ANGEL';

    this.ctx.save();

    if (this.postFeverInvulnerabilityTime > 0 && Math.floor(Date.now() / 70) % 2 === 0) {
      this.ctx.globalAlpha = 0.3;
    }

    let drawWidth = this.player.baseWidth;
    let drawHeight = this.player.baseHeight;
    let drawX = this.player.x;
    let drawY = this.player.y;

    if (isSliding) {
      drawWidth = this.player.baseWidth * 1.25;
      drawHeight = this.player.baseHeight * 0.48;
      const surface = this.player.currentPlatform ? this.player.currentPlatform.y : this.GROUND_Y;
      drawY = surface - drawHeight;
    } else if (this.player.isGrounded) {
      const bounce = Math.sin(this.player.bouncePhase);
      drawY = this.player.y + bounce * 4;
      const squash = 1 - bounce * 0.05;
      drawHeight = this.player.baseHeight * squash;
      drawWidth = this.player.baseWidth * (1 + bounce * 0.04);
    }

    const centerX = drawX + drawWidth / 2;
    const centerY = drawY + drawHeight / 2;
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(this.player.rotation);

    if (this.state === 'GAMEOVER') {
      this.ctx.filter = 'drop-shadow(0px 0px 8px #ef4444)';
    }

    if (this.isAssetsLoaded && this.playerImg.complete && this.playerImg.naturalWidth > 0) {
      this.ctx.drawImage(
        this.playerImg,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
    } else {
      this.ctx.fillStyle = isAngel ? '#fef08a' : '#ef4444';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, drawHeight / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(6, -4, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  /**
   * FEVER SCREEN EFFECTS & REMAINING DURATION HUD
   * - Angel: Radiant celestial golden/cyan light rays & border aura
   * - Devil: Fiery infernal crimson/orange flame tongues & ember border
   * - High-impact timer bar showing remaining fever duration
   */
  private drawFeverBorderEffects() {
    if (!this.isFeverActive) return;

    const isAngel = this.faction === 'ANGEL';
    const time = Date.now() * 0.005;
    const pulse = 0.75 + Math.sin(time * 3.5) * 0.25;

    this.ctx.save();

    if (isAngel) {
      // -------------------------------------------------------------
      // ANGEL FEVER: RADIANT GOLDEN & CYAN CELESTIAL LIGHT RAYS
      // -------------------------------------------------------------
      // Top radiant glow
      const topGrad = this.ctx.createLinearGradient(0, 0, 0, 85);
      topGrad.addColorStop(0, `rgba(250, 204, 21, ${0.75 * pulse})`);
      topGrad.addColorStop(0.4, `rgba(56, 189, 248, ${0.45 * pulse})`);
      topGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      this.ctx.fillStyle = topGrad;
      this.ctx.fillRect(0, 0, this.V_WIDTH, 85);

      // Bottom radiant glow
      const botGrad = this.ctx.createLinearGradient(0, this.V_HEIGHT, 0, this.V_HEIGHT - 85);
      botGrad.addColorStop(0, `rgba(250, 204, 21, ${0.85 * pulse})`);
      botGrad.addColorStop(0.4, `rgba(56, 189, 248, ${0.45 * pulse})`);
      botGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      this.ctx.fillStyle = botGrad;
      this.ctx.fillRect(0, this.V_HEIGHT - 85, this.V_WIDTH, 85);

      // Left & Right radiant borders
      const leftGrad = this.ctx.createLinearGradient(0, 0, 65, 0);
      leftGrad.addColorStop(0, `rgba(56, 189, 248, ${0.7 * pulse})`);
      leftGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      this.ctx.fillStyle = leftGrad;
      this.ctx.fillRect(0, 0, 65, this.V_HEIGHT);

      const rightGrad = this.ctx.createLinearGradient(this.V_WIDTH, 0, this.V_WIDTH - 65, 0);
      rightGrad.addColorStop(0, `rgba(250, 204, 21, ${0.7 * pulse})`);
      rightGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      this.ctx.fillStyle = rightGrad;
      this.ctx.fillRect(this.V_WIDTH - 65, 0, 65, this.V_HEIGHT);

      // Holy Light Beams from Screen Corners
      this.ctx.strokeStyle = `rgba(254, 240, 138, ${0.4 * pulse})`;
      this.ctx.lineWidth = 3.5;
      for (let r = 0; r < 5; r++) {
        const offset = ((time * 45 + r * 55) % 180);
        this.ctx.beginPath();
        this.ctx.moveTo(offset, 0);
        this.ctx.lineTo(offset + 140, 110);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.V_WIDTH - offset, 0);
        this.ctx.lineTo(this.V_WIDTH - offset - 140, 110);
        this.ctx.stroke();
      }
    } else {
      // -------------------------------------------------------------
      // DEVIL FEVER: INFERNAL FLAME LICKING BORDER & RISING EMBERS
      // -------------------------------------------------------------
      // Top fiery glow
      const topGrad = this.ctx.createLinearGradient(0, 0, 0, 85);
      topGrad.addColorStop(0, `rgba(239, 68, 68, ${0.85 * pulse})`);
      topGrad.addColorStop(0.4, `rgba(249, 115, 22, ${0.5 * pulse})`);
      topGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      this.ctx.fillStyle = topGrad;
      this.ctx.fillRect(0, 0, this.V_WIDTH, 85);

      // Bottom fiery glow
      const botGrad = this.ctx.createLinearGradient(0, this.V_HEIGHT, 0, this.V_HEIGHT - 85);
      botGrad.addColorStop(0, `rgba(220, 38, 38, ${0.9 * pulse})`);
      botGrad.addColorStop(0.4, `rgba(249, 115, 22, ${0.55 * pulse})`);
      botGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      this.ctx.fillStyle = botGrad;
      this.ctx.fillRect(0, this.V_HEIGHT - 85, this.V_WIDTH, 85);

      // Left & Right fiery borders
      const leftGrad = this.ctx.createLinearGradient(0, 0, 65, 0);
      leftGrad.addColorStop(0, `rgba(239, 68, 68, ${0.75 * pulse})`);
      leftGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      this.ctx.fillStyle = leftGrad;
      this.ctx.fillRect(0, 0, 65, this.V_HEIGHT);

      const rightGrad = this.ctx.createLinearGradient(this.V_WIDTH, 0, this.V_WIDTH - 65, 0);
      rightGrad.addColorStop(0, `rgba(249, 115, 22, ${0.75 * pulse})`);
      rightGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      this.ctx.fillStyle = rightGrad;
      this.ctx.fillRect(this.V_WIDTH - 65, 0, 65, this.V_HEIGHT);

      // Dynamic animated flame tongues licking along top and bottom edges
      this.ctx.fillStyle = `rgba(251, 146, 60, ${0.75 * pulse})`;
      for (let fx = 0; fx < this.V_WIDTH; fx += 26) {
        const topFlameH = 16 + Math.sin(time * 6 + fx) * 11;
        this.ctx.beginPath();
        this.ctx.moveTo(fx, 0);
        this.ctx.lineTo(fx + 13, topFlameH);
        this.ctx.lineTo(fx + 26, 0);
        this.ctx.closePath();
        this.ctx.fill();

        const botFlameH = 16 + Math.cos(time * 6 + fx) * 11;
        this.ctx.beginPath();
        this.ctx.moveTo(fx, this.V_HEIGHT);
        this.ctx.lineTo(fx + 13, this.V_HEIGHT - botFlameH);
        this.ctx.lineTo(fx + 26, this.V_HEIGHT);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }

    // -------------------------------------------------------------
    // FEVER DURATION TIMER DISPLAY (ARCADE CANVAS HUD)
    // -------------------------------------------------------------
    const badgeW = 270;
    const badgeH = 42;
    const bx = this.V_WIDTH / 2 - badgeW / 2;
    const by = 16;

    // Badge Background (Dark transluscent glass with faction neon border)
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    this.ctx.strokeStyle = isAngel ? '#facc15' : '#ef4444';
    this.ctx.lineWidth = 3;

    const br = 14;
    this.ctx.beginPath();
    this.ctx.moveTo(bx + br, by);
    this.ctx.lineTo(bx + badgeW - br, by);
    this.ctx.quadraticCurveTo(bx + badgeW, by, bx + badgeW, by + br);
    this.ctx.lineTo(bx + badgeW, by + badgeH - br);
    this.ctx.quadraticCurveTo(bx + badgeW, by + badgeH, bx + badgeW - br, by + badgeH);
    this.ctx.lineTo(bx + br, by + badgeH);
    this.ctx.quadraticCurveTo(bx, by + badgeH, bx, by + badgeH - br);
    this.ctx.lineTo(bx, by + br);
    this.ctx.quadraticCurveTo(bx, by, bx + br, by);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Fever Text & Timer
    this.ctx.font = '900 17px "Black Han Sans", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = isAngel ? '#fef08a' : '#fca5a5';
    this.ctx.fillText(
      `⚡ 피버 타임: ${Math.max(0, this.feverTimer).toFixed(1)}초 ⚡`,
      this.V_WIDTH / 2,
      by + 23
    );

    // Draining Progress Bar
    const progress = Math.max(0, Math.min(1, this.feverTimer / this.feverDuration));
    const pbarW = (badgeW - 24) * progress;
    this.ctx.fillStyle = isAngel ? '#38bdf8' : '#ef4444';
    this.ctx.fillRect(bx + 12, by + badgeH - 7, pbarW, 3.5);

    this.ctx.restore();
  }

  private drawStateOverlays() {
    if (this.state === 'COUNTDOWN') {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this.ctx.fillRect(0, 0, this.V_WIDTH, this.V_HEIGHT);

      this.ctx.font = '900 78px "Black Han Sans", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.lineWidth = 8;
      this.ctx.strokeStyle = '#000000';
      this.ctx.fillStyle = this.countdownTimer === 0 ? '#4ade80' : '#facc15';

      const label = this.countdownTimer === 0 ? 'START!' : `${this.countdownTimer}`;
      this.ctx.strokeText(label, this.V_WIDTH / 2, this.V_HEIGHT / 2);
      this.ctx.fillText(label, this.V_WIDTH / 2, this.V_HEIGHT / 2);

      this.ctx.restore();
    } else if (this.state === 'READY') {
      this.ctx.save();
      this.ctx.font = '900 36px "Black Han Sans", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.lineWidth = 6;
      this.ctx.strokeStyle = '#000000';
      this.ctx.fillStyle = '#ffffff';

      const pulse = Math.sin(Date.now() * 0.006) * 4;
      this.ctx.strokeText('질주 준비 완료!', this.V_WIDTH / 2, this.V_HEIGHT / 2 - 30 + pulse);
      this.ctx.fillText('질주 준비 완료!', this.V_WIDTH / 2, this.V_HEIGHT / 2 - 30 + pulse);

      this.ctx.font = '700 18px "Noto Sans KR", sans-serif';
      this.ctx.fillStyle = '#fef08a';
      this.ctx.strokeText('스페이스바 / 점프 버튼을 누르거나 시작 버튼을 클릭하세요', this.V_WIDTH / 2, this.V_HEIGHT / 2 + 15);
      this.ctx.fillText('스페이스바 / 점프 버튼을 누르거나 시작 버튼을 클릭하세요', this.V_WIDTH / 2, this.V_HEIGHT / 2 + 15);
      this.ctx.restore();
    }
  }
}
