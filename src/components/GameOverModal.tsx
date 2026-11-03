import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, Sparkles, CheckCircle2, Lock, Sun, Flame } from 'lucide-react';
import { PlayRecord, PlayerData } from '../api.js';

interface GameOverModalProps {
  isOpen: boolean;
  record: PlayRecord | null;
  player: PlayerData | null;
  chipsAwarded: number;
  isTestPlay: boolean;
  onRetry: () => void;
  onGoHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  record,
  player,
  chipsAwarded,
  isTestPlay,
  onRetry,
  onGoHome,
}) => {
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconFailed(false);
  }, [record?.id, record?.faction]);

  useEffect(() => {
    if (isOpen && record && record.score > 200) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#38bdf8', '#facc15', '#ef4444', '#ffffff'],
        });
      } catch {}
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const isAngel = record.faction === 'ANGEL';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-4 border-slate-900 bg-slate-900 p-6 shadow-[8px_8px_0px_#000000] text-center">
        {/* Glow backdrop */}
        <div
          className={`pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full blur-3xl ${
            isAngel ? 'bg-sky-500/20' : 'bg-rose-500/20'
          }`}
        />

        {/* Faction & GameOver Header */}
        <div className="relative mb-4 flex flex-col items-center">
          {iconFailed ? (
            <div
              role="img"
              aria-label={isAngel ? '천사 진영' : '악마 진영'}
              className={`mb-2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-black shadow-[0_0_16px_rgba(250,204,21,0.35)] ${isAngel ? 'bg-sky-400 text-slate-950' : 'bg-rose-500 text-white'}`}
            >
              {isAngel ? <Sun className="h-10 w-10" /> : <Flame className="h-10 w-10" />}
            </div>
          ) : (
            <img
              src={isAngel ? '/assets/angel.png' : '/assets/devil.png'}
              alt={isAngel ? '천사 진영' : '악마 진영'}
              onError={() => setIconFailed(true)}
              className="h-16 w-16 object-contain drop-shadow-[0_0_12px_rgba(250,204,21,0.5)] mb-2"
            />
          )}
          <span
            className={`text-xs font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full border-2 border-black shadow-[2px_2px_0px_#000] mb-1 ${
              isAngel ? 'bg-sky-400 text-slate-950' : 'bg-rose-500 text-white'
            }`}
          >
            {isAngel ? '천사 진영' : '악마 진영'}
          </span>
          <h2 className="font-['Black_Han_Sans'] text-3xl sm:text-4xl text-white drop-shadow">질주 종료!</h2>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-xs">
            <span className="font-black text-slate-100">{record.playerNickname || player?.nickname || '플레이어'}</span>
            {player?.isDiscord && player.discordUsername && (
              <span className="font-bold text-indigo-400">@{player.discordUsername}</span>
            )}
          </div>
          {isTestPlay && (
            <span className="mt-1.5 rounded-lg bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-slate-950 border-2 border-black shadow-[2px_2px_0px_#000]">
              개발자 테스트 플레이 (기록 미반영)
            </span>
          )}
        </div>

        {/* Big Score Card */}
        <div className="mb-4 rounded-2xl border-3 border-black bg-slate-950 p-4 shadow-[4px_4px_0px_#000]">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">이번 판 획득 점수</span>
          <div className="font-['Black_Han_Sans'] text-4xl sm:text-5xl text-amber-300 tracking-wide mt-1 drop-shadow">
            {record.score.toLocaleString()}
            <span className="text-base font-black text-slate-400 ml-1">P</span>
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-4 text-xs font-bold text-slate-400 border-t border-slate-850 pt-2">
            <span>주행 거리: <strong className="text-white font-black">{record.distance}m</strong></span>
            <span>생존 시간: <strong className="text-white font-black">{record.durationSeconds}초</strong></span>
          </div>
        </div>

        {/* Event Chip Reward Badge */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border-3 border-black bg-amber-400/15 p-3.5 shadow-[4px_4px_0px_#000]">
          <div className="flex items-center gap-2.5">
            <img src="/assets/chip.png" alt="이벤트 칩" className="h-9 w-9 object-contain drop-shadow" />
            <div className="text-left">
              <span className="block text-xs font-black text-amber-200">지급된 이벤트 칩</span>
              <span className="text-[10px] font-bold text-amber-300/80">
                (수집 {record.chipsCollectedInGame}개 + 점수 환산)
              </span>
            </div>
          </div>
          <div className="font-['Black_Han_Sans'] text-2xl sm:text-3xl text-amber-300 drop-shadow">
            +{chipsAwarded}
          </div>
        </div>

        {/* Cumulative Stats */}
        {player && !isTestPlay && (
          <div className="mb-5 rounded-2xl border-3 border-black bg-slate-950 p-3 text-xs font-bold text-slate-400 shadow-[3px_3px_0px_#000]">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span>내 총 누적 점수 (진영 반영):</span>
              <strong className="text-white font-black">{player.totalScore.toLocaleString()}P</strong>
            </div>
            <div className="flex justify-between py-1">
              <span>내 최고 단일 기록:</span>
              <strong className="text-amber-300 font-black">{player.highScore.toLocaleString()}P</strong>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-3 border-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 py-3.5 text-base font-['Black_Han_Sans'] text-slate-950 shadow-[4px_4px_0px_#000] hover:scale-[1.02] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] transition-all"
          >
            <RotateCcw className="h-4 w-4" />
            다시 도전
          </button>
          <button
            onClick={onGoHome}
            className="flex items-center justify-center gap-1.5 rounded-2xl border-3 border-black bg-slate-800 px-5 py-3.5 text-sm font-['Black_Han_Sans'] text-slate-200 shadow-[4px_4px_0px_#000] hover:bg-slate-700 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] transition-all"
          >
            <Home className="h-4 w-4" />
            메인으로
          </button>
        </div>
      </div>
    </div>
  );
};
