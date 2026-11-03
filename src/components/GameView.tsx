import React, { useEffect, useRef, useState } from 'react';
import { RunnerGame, GameMetrics, GameFaction } from '../game/RunnerGame.js';
import { PlayerData } from '../api.js';
import { Pause, Play, LogOut, ArrowUp, ArrowDown } from 'lucide-react';

interface GameViewProps {
  faction: GameFaction;
  player: PlayerData | null;
  onGameOver: (metrics: GameMetrics) => void;
  onQuit: () => void;
  isTestMode: boolean;
  lives: number;
}

export const GameView: React.FC<GameViewProps> = ({
  faction,
  player,
  onGameOver,
  onQuit,
  isTestMode,
  lives,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<RunnerGame | null>(null);

  const [metrics, setMetrics] = useState<GameMetrics>({
    score: 0,
    distance: 0,
    chipsCollected: 0,
    speed: 360,
    durationSeconds: 0,
    jumpsCount: 0,
    slidesCount: 0,
    feverMeter: 0,
    isFeverActive: false,
    feverTimer: 0,
  });

  const [isPaused, setIsPaused] = useState(false);
  const [isJumpingPressed, setIsJumpingPressed] = useState(false);
  const [isSlidingPressed, setIsSlidingPressed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new RunnerGame(canvasRef.current, faction);
    gameRef.current = game;

    game.setCallbacks({
      onMetricsUpdate: (m) => setMetrics({ ...m }),
      onGameOver: (m) => onGameOver(m),
    });

    game.startLoop();
    // Start countdown immediately upon entering
    game.startCountdown();

    return () => {
      game.destroy();
    };
  }, [faction]);

  const handleTogglePause = () => {
    if (!gameRef.current) return;
    if (isPaused) {
      gameRef.current.resume();
      setIsPaused(false);
    } else {
      gameRef.current.pause();
      setIsPaused(true);
    }
  };

  // Mobile Touch Handlers
  const handleJumpTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsJumpingPressed(true);
    gameRef.current?.triggerJump();
  };

  const handleJumpTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsJumpingPressed(false);
  };

  const handleSlideTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsSlidingPressed(true);
    gameRef.current?.triggerSlide(true);
  };

  const handleSlideTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsSlidingPressed(false);
    gameRef.current?.triggerSlide(false);
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-5xl mx-auto px-2 py-2">
      {/* Arcade Screen Frame */}
      <div
        className={`relative w-full aspect-[960/500] max-h-[72vh] overflow-hidden rounded-2xl border-4 transition-all duration-300 ${
          metrics.isFeverActive
            ? faction === 'ANGEL'
              ? 'border-sky-300 fever-border-angel shadow-[0_0_55px_rgba(56,189,248,0.85)]'
              : 'border-rose-500 fever-border-devil shadow-[0_0_55px_rgba(239,68,68,0.85)]'
            : 'border-slate-800 bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* HTML5 Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-full block cursor-pointer select-none"
          onClick={() => {
            gameRef.current?.triggerJump();
          }}
        />

        {/* HUD Top Bar Overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
          <div className="rounded-full border border-rose-500/40 bg-black/60 px-2.5 py-1 text-xs font-black text-rose-300">목숨 {lives}/10</div>
          {/* Distance, Score, and Fever Gauge */}
          <div className="flex items-center gap-3 sm:gap-5 pointer-events-auto">
            {/* Score */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 leading-none">
                SCORE
              </span>
              <span className="font-['Black_Han_Sans'] text-2xl sm:text-3xl text-white tracking-wide leading-tight">
                {metrics.score.toLocaleString()}
              </span>
            </div>

            {/* Distance */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                DISTANCE
              </span>
              <span className="font-mono text-lg sm:text-xl font-black text-slate-200 leading-tight">
                {metrics.distance}m
              </span>
            </div>

            {/* Collected Chips */}
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-black/60 px-2.5 py-1">
              <img src="/assets/chip.png" alt="이벤트 칩" className="h-5 w-5 object-contain" />
              <span className="font-mono text-sm font-black text-amber-300">
                +{metrics.chipsCollected}
              </span>
            </div>

            {/* Fever Gauge */}
            <div className="hidden xs:flex flex-col">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    metrics.isFeverActive ? 'text-amber-300 animate-pulse' : 'text-slate-400'
                  }`}
                >
                  {metrics.isFeverActive ? '⚡ FEVER ⚡' : 'FEVER'}
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-300">
                  {metrics.isFeverActive
                    ? `${metrics.feverTimer.toFixed(1)}s`
                    : `${metrics.feverMeter}%`}
                </span>
              </div>
              <div className="h-2 w-16 sm:w-24 overflow-hidden rounded-full bg-slate-900 border border-slate-700">
                <div
                  className={`h-full transition-all duration-200 ${
                    metrics.isFeverActive
                      ? faction === 'ANGEL'
                        ? 'bg-gradient-to-r from-sky-400 via-amber-300 to-white animate-pulse'
                        : 'bg-gradient-to-r from-rose-500 via-amber-500 to-white animate-pulse'
                      : faction === 'ANGEL'
                      ? 'bg-gradient-to-r from-sky-500 to-sky-300'
                      : 'bg-gradient-to-r from-rose-600 to-amber-500'
                  }`}
                  style={{
                    width: metrics.isFeverActive
                      ? `${(metrics.feverTimer / 6.0) * 100}%`
                      : `${metrics.feverMeter}%`,
                  }}
                />
              </div>
            </div>

            {isTestMode && (
              <span className="rounded bg-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/50">
                TEST
              </span>
            )}
          </div>

          {/* Player Tag & Action Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {player && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-black/60 px-3 py-1 text-xs">
                <span className="font-bold text-white">{player.nickname}</span>
                {player.isDiscord && player.discordUsername && (
                  <span className="font-semibold text-indigo-400">
                    @{player.discordUsername}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={handleTogglePause}
              className="rounded-xl border border-slate-700 bg-slate-950/80 p-2 text-white hover:bg-slate-800 transition-colors"
              title={isPaused ? '계속하기' : '일시정지'}
            >
              {isPaused ? <Play className="h-5 w-5 text-emerald-400" /> : <Pause className="h-5 w-5 text-amber-400" />}
            </button>

            <button
              onClick={onQuit}
              className="rounded-xl border border-slate-700 bg-slate-950/80 p-2 text-slate-300 hover:bg-rose-950 hover:text-rose-400 transition-colors"
              title="게임 나가기"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Paused Overlay */}
        {isPaused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
            <h3 className="font-['Black_Han_Sans'] text-3xl text-white mb-4">일시정지</h3>
            <button
              onClick={handleTogglePause}
              className="rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-slate-950 hover:bg-amber-400"
            >
              계속하기
            </button>
          </div>
        )}
      </div>

      {/* Mobile Touch Controls (Bottom Bar) */}
      <div className="w-full flex items-center justify-between mt-3 px-2">
        {/* Slide Button (Left) */}
        <button
          onTouchStart={handleSlideTouchStart}
          onTouchEnd={handleSlideTouchEnd}
          onMouseDown={handleSlideTouchStart}
          onMouseUp={handleSlideTouchEnd}
          className={`flex h-16 sm:h-20 flex-1 max-w-[210px] items-center justify-center gap-2 rounded-2xl border-3 border-black text-base sm:text-lg font-['Black_Han_Sans'] transition-all select-none touch-none shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] ${
            isSlidingPressed
              ? 'bg-amber-500 text-slate-950'
              : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
          }`}
        >
          <ArrowDown className="h-6 w-6" />
          <span>슬라이딩 [↓]</span>
        </button>

        {/* Speed / Controls Info */}
        <div className="hidden sm:flex flex-col items-center text-center px-4 py-2 rounded-xl border-2 border-black bg-slate-950 shadow-[2px_2px_0px_#000] text-xs">
          <span className="font-['Black_Han_Sans'] text-amber-400">키보드 조작 안내</span>
          <span className="text-slate-300 font-bold">Space / ↑ : 점프 | ↓ : 슬라이딩</span>
        </div>

        {/* Jump Button (Right) */}
        <button
          onTouchStart={handleJumpTouchStart}
          onTouchEnd={handleJumpTouchEnd}
          onMouseDown={handleJumpTouchStart}
          onMouseUp={handleJumpTouchEnd}
          className={`flex h-16 sm:h-20 flex-1 max-w-[210px] items-center justify-center gap-2 rounded-2xl border-3 border-black text-base sm:text-lg font-['Black_Han_Sans'] transition-all select-none touch-none shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] ${
            isJumpingPressed
              ? 'bg-sky-500 text-slate-950'
              : 'bg-sky-400 text-slate-950 hover:bg-sky-300'
          }`}
        >
          <ArrowUp className="h-6 w-6" />
          <span>점프 [Space]</span>
        </button>
      </div>
    </div>
  );
};
