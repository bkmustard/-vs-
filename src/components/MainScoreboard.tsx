import React, { useEffect, useState } from 'react';
import { FactionScoresResponse } from '../api.js';
import { Clock, Flame, Sparkles, Swords, Award } from 'lucide-react';

interface MainScoreboardProps {
  scores: FactionScoresResponse | null;
  onRefresh: () => void;
}

export const MainScoreboard: React.FC<MainScoreboardProps> = ({ scores }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isEnded: boolean;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isEnded: false,
  });

  useEffect(() => {
    if (!scores?.eventConfig?.endTime) return;

    const calcTime = () => {
      const target = new Date(scores.eventConfig.endTime).getTime();
      const diff = target - Date.now();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isEnded: false });
    };

    calcTime();
    const timer = setInterval(calcTime, 1000);
    return () => clearInterval(timer);
  }, [scores?.eventConfig?.endTime]);

  const angelScore = scores?.angel?.totalScore || 0;
  const devilScore = scores?.devil?.totalScore || 0;
  const totalScore = angelScore + devilScore;

  // Percentage for progress bar (default 50-50 if 0 points)
  const angelPct = totalScore === 0 ? 50 : Math.round((angelScore / totalScore) * 100);
  const devilPct = 100 - angelPct;

  const leading = scores?.leadingFaction || 'TIE';
  const diff = scores?.scoreDiff || 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border-4 border-slate-900 bg-slate-900 shadow-[8px_8px_0px_#000000]">
      {/* Dynamic Faction Glow Accents */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />

      {/* Top Banner: Status & Event Countdown */}
      <div className="flex flex-wrap items-center justify-between border-b-4 border-slate-900 bg-slate-950 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-black text-slate-400">대항전 종료까지:</span>
          {timeLeft.isEnded ? (
            <span className="text-xs font-black text-rose-400">이벤트 종료</span>
          ) : (
            <span className="font-mono text-xs font-black tracking-wider text-amber-300 bg-slate-900 px-2.5 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000]">
              {timeLeft.days}일 {String(timeLeft.hours).padStart(2, '0')}:
              {String(timeLeft.minutes).padStart(2, '0')}:
              {String(timeLeft.seconds).padStart(2, '0')}
            </span>
          )}
        </div>

        {/* Current Leader Status */}
        <div className="flex items-center gap-1.5 text-xs font-black">
          {leading === 'ANGEL' ? (
            <span className="flex items-center gap-1 text-sky-400 bg-sky-950/80 px-2.5 py-1 rounded-lg border-2 border-sky-500/50 shadow-[2px_2px_0px_#000]">
              <Sparkles className="h-3.5 w-3.5" />
              천사 진영이 {diff.toLocaleString()}P 우세!
            </span>
          ) : leading === 'DEVIL' ? (
            <span className="flex items-center gap-1 text-rose-400 bg-rose-950/80 px-2.5 py-1 rounded-lg border-2 border-rose-500/50 shadow-[2px_2px_0px_#000]">
              <Flame className="h-3.5 w-3.5" />
              악마 진영이 {diff.toLocaleString()}P 우세!
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border-2 border-amber-500/40 shadow-[2px_2px_0px_#000]">
              <Swords className="h-3.5 w-3.5" />
              양 진영 팽팽한 접전 중!
            </span>
          )}
        </div>
      </div>

      {/* CONTINUOUS FACTION ICON CLASH ARENA */}
      <div className="relative py-4 px-6 border-b-4 border-slate-900 bg-gradient-to-r from-sky-950/40 via-slate-950 to-rose-950/40 flex flex-col items-center justify-center overflow-hidden">
        <div className="relative flex items-center justify-center h-24 w-full max-w-md">
          {/* Angel Icon Charging */}
          <div className="absolute left-1/2 -ml-28 flex flex-col items-center animate-angel-clash z-10">
            <div className="relative">
              <img
                src="/assets/angel.png"
                alt="천사 진영 아이콘"
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-[0_0_15px_rgba(56,189,248,0.8)] select-none"
              />
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-['Black_Han_Sans'] text-[10px] tracking-wider text-sky-300 whitespace-nowrap bg-sky-950 px-2 py-0.5 rounded-md border-2 border-sky-400 shadow-[2px_2px_0px_#000]">
                ANGEL
              </span>
            </div>
          </div>

          {/* Central Impact Burst & VS badge */}
          <div className="relative flex items-center justify-center z-20">
            {/* Impact Shockwave Rings */}
            <div className="pointer-events-none absolute h-24 w-24 rounded-full border-3 border-amber-400/90 animate-clash-ring" />
            <div className="pointer-events-none absolute h-16 w-16 rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-rose-500 blur-md animate-clash-burst" />

            {/* Central VS Badge */}
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 border-3 border-black shadow-[3px_3px_0px_#000]">
              <span className="font-['Black_Han_Sans'] text-base italic text-slate-950">VS</span>
            </div>
          </div>

          {/* Devil Icon Charging */}
          <div className="absolute right-1/2 -mr-28 flex flex-col items-center animate-devil-clash z-10">
            <div className="relative">
              <img
                src="/assets/devil.png"
                alt="악마 진영 아이콘"
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] select-none"
              />
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-['Black_Han_Sans'] text-[10px] tracking-wider text-rose-300 whitespace-nowrap bg-rose-950 px-2 py-0.5 rounded-md border-2 border-rose-500 shadow-[2px_2px_0px_#000]">
                DEVIL
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-[11px] font-black text-slate-400">
          <span className="text-sky-400 font-['Black_Han_Sans']">천사</span>
          <span className="text-amber-300 bg-black/60 px-2 py-0.5 rounded-full border border-black shadow">⚡ 영구 진영 대격돌 진행 중 ⚡</span>
          <span className="text-rose-400 font-['Black_Han_Sans']">악마</span>
        </div>
      </div>

      {/* Main Score Battle Arena */}
      <div className="grid grid-cols-1 gap-5 p-4 sm:p-6 md:grid-cols-2">
        {/* ANGEL TEAM CARD */}
        <div
          className={`relative overflow-hidden rounded-2xl border-3 p-5 transition-all ${
            leading === 'ANGEL'
              ? 'border-black bg-gradient-to-br from-sky-950 via-slate-950 to-sky-950/70 shadow-[5px_5px_0px_#0284c7]'
              : 'border-black bg-slate-950/80 shadow-[4px_4px_0px_#000000]'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="/assets/angel.png"
                  alt="천사 진영"
                  className="h-16 w-16 object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                />
                {leading === 'ANGEL' && (
                  <div className="absolute -top-2 -right-2 rounded-full border-2 border-black bg-amber-400 p-1 text-black shadow-[2px_2px_0px_#000]">
                    <Award className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-sky-400">
                  ANGEL TEAM
                </span>
                <h3 className="font-['Black_Han_Sans'] text-2xl text-white drop-shadow">천사 진영</h3>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400">총 누적 점수</span>
              <div className="font-['Black_Han_Sans'] text-3xl tracking-wide text-sky-300 sm:text-4xl drop-shadow">
                {angelScore.toLocaleString()}
                <span className="text-sm font-bold text-sky-400/80 ml-1">P</span>
              </div>
            </div>
          </div>

          {/* Sub Stats */}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t-2 border-slate-800 pt-3 text-xs font-bold">
            <div>
              <span className="text-slate-400">참여 인원:</span>{' '}
              <strong className="text-sky-200">{scores?.angel?.playersCount || 0}명</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400">출격 횟수:</span>{' '}
              <strong className="text-sky-200">{scores?.angel?.playCount || 0}회</strong>
            </div>
          </div>
        </div>

        {/* DEVIL TEAM CARD */}
        <div
          className={`relative overflow-hidden rounded-2xl border-3 p-5 transition-all ${
            leading === 'DEVIL'
              ? 'border-black bg-gradient-to-br from-rose-950 via-slate-950 to-rose-950/70 shadow-[5px_5px_0px_#b91c1c]'
              : 'border-black bg-slate-950/80 shadow-[4px_4px_0px_#000000]'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="/assets/devil.png"
                  alt="악마 진영"
                  className="h-16 w-16 object-contain drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]"
                />
                {leading === 'DEVIL' && (
                  <div className="absolute -top-2 -right-2 rounded-full border-2 border-black bg-amber-400 p-1 text-black shadow-[2px_2px_0px_#000]">
                    <Award className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-rose-400">
                  DEVIL TEAM
                </span>
                <h3 className="font-['Black_Han_Sans'] text-2xl text-white drop-shadow">악마 진영</h3>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400">총 누적 점수</span>
              <div className="font-['Black_Han_Sans'] text-3xl tracking-wide text-rose-400 sm:text-4xl drop-shadow">
                {devilScore.toLocaleString()}
                <span className="text-sm font-bold text-rose-500/80 ml-1">P</span>
              </div>
            </div>
          </div>

          {/* Sub Stats */}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t-2 border-slate-800 pt-3 text-xs font-bold">
            <div>
              <span className="text-slate-400">참여 인원:</span>{' '}
              <strong className="text-rose-200">{scores?.devil?.playersCount || 0}명</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400">출격 횟수:</span>{' '}
              <strong className="text-rose-200">{scores?.devil?.playCount || 0}회</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tug-of-War Battle Progress Bar */}
      <div className="border-t-4 border-slate-900 bg-slate-950 px-6 py-4">
        <div className="mb-2 flex items-center justify-between text-xs font-black">
          <span className="text-sky-400">ANGEL {angelPct}%</span>
          <span className="text-slate-400 text-[11px] font-bold">총 {scores?.totalPlayCount || 0}회 출격</span>
          <span className="text-rose-400">DEVIL {devilPct}%</span>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-950 border-3 border-black shadow-[3px_3px_0px_#000]">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-amber-300 transition-all duration-700 ease-out"
            style={{ width: `${angelPct}%` }}
          />
          <div
            className="absolute right-0 top-0 h-full bg-gradient-to-l from-rose-500 to-amber-500 transition-all duration-700 ease-out"
            style={{ width: `${devilPct}%` }}
          />
          {/* Center Tug Pin */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-6 w-2 rounded-full bg-white border border-black shadow-[0_0_8px_white] transition-all duration-700"
            style={{ left: `${angelPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
