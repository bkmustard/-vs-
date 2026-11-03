import React from 'react';
import { Volume2, VolumeX, Shield, Users, Trophy, Lock } from 'lucide-react';
import { PlayerData } from '../api.js';

interface HeaderProps {
  player: PlayerData | null;
  onOpenLeaderboard: () => void;
  onOpenGuestModal: () => void;
  onOpenDiscordModal: () => void;
  onOpenDevModal: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isTestMode: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  player,
  onOpenLeaderboard,
  onOpenGuestModal,
  onOpenDiscordModal,
  onOpenDevModal,
  isMuted,
  onToggleMute,
  isTestMode,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b-4 border-slate-900 bg-slate-950/90 backdrop-blur-md shadow-[0_4px_0_#000000]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-6">
        {/* Logo and Game Title */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <img
            src="/assets/logo.png"
            alt="천사 VS 악마 로고"
            className="h-10 w-10 sm:h-11 sm:w-11 object-contain drop-shadow-[0_0_12px_rgba(250,204,21,0.4)] transition-transform hover:scale-105"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-['Black_Han_Sans'] text-lg tracking-wide text-white sm:text-xl drop-shadow">
                천사 <span className="text-amber-400">VS</span> 악마
              </h1>
              <span className="rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] sm:text-[11px] font-black text-black border-2 border-black shadow-[2px_2px_0_#000]">
                기반스타즈 S8
              </span>
              {isTestMode && (
                <span className="rounded-lg bg-emerald-400 px-1.5 py-0.5 text-[10px] font-black text-black border-2 border-black shadow-[2px_2px_0_#000] animate-pulse">
                  TEST
                </span>
              )}
            </div>
            <p className="hidden text-xs font-bold text-slate-400 sm:block">
              진영 대항 무한 질주 아케이드
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Player Badge if logged in */}
          {player ? (
            <button
              onClick={onOpenGuestModal}
              className="flex items-center gap-2 rounded-2xl border-3 border-black bg-slate-900 py-1 pl-2 pr-3 text-xs shadow-[3px_3px_0px_#000] hover:bg-slate-850 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000] transition-all"
              title="프로필 및 닉네임 설정"
            >
              <img
                src={player.faction === 'ANGEL' ? '/assets/angel.png' : '/assets/devil.png'}
                alt={player.faction}
                className="h-7 w-7 object-contain"
              />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1 leading-none">
                  <span className="font-black text-slate-100">{player.nickname}</span>
                  {player.isDiscord && player.discordUsername && (
                    <span className="text-[11px] font-bold text-indigo-400">
                      @{player.discordUsername}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[10px] font-black ${player.faction === 'ANGEL' ? 'text-sky-300' : 'text-rose-400'}`}>
                    {player.faction === 'ANGEL' ? '천사 진영' : '악마 진영'}
                  </span>
                  <Lock className="h-2.5 w-2.5 text-slate-400" />
                </div>
              </div>
            </button>
          ) : (
            <button
              onClick={onOpenGuestModal}
              className="flex items-center gap-1.5 rounded-xl border-3 border-black bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950 shadow-[3px_3px_0px_#000] hover:bg-amber-300 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000] transition-all"
            >
              <Users className="h-3.5 w-3.5" />
              진영 선택
            </button>
          )}

          {/* Leaderboard button */}
          <button
            onClick={onOpenLeaderboard}
            className="flex items-center gap-1 rounded-xl border-2 border-black bg-slate-800 px-2.5 py-1.5 text-xs font-black text-white shadow-[2px_2px_0px_#000] hover:bg-slate-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title="실시간 랭킹"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="hidden sm:inline">랭킹</span>
          </button>

          {/* Discord button */}
          <button
            onClick={onOpenDiscordModal}
            className="flex items-center gap-1 rounded-xl border-2 border-black bg-indigo-900 px-2.5 py-1.5 text-xs font-black text-indigo-200 shadow-[2px_2px_0px_#000] hover:bg-indigo-800 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title="디스코드 연동 및 경제 봇 상태"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">디스코드</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            className="rounded-xl border-2 border-black bg-slate-800 p-2 text-slate-200 shadow-[2px_2px_0px_#000] hover:bg-slate-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title={isMuted ? '음소거 해제 (BGM & 효과음)' : '음소거 (BGM & 효과음)'}
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>

          {/* Dev Panel Auth Button - Secret Protected without exposing passcode */}
          <button
            onClick={onOpenDevModal}
            className="rounded-xl border-2 border-black bg-slate-900 p-2 text-slate-400 shadow-[2px_2px_0px_#000] hover:border-amber-400 hover:text-amber-400 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title="개발자 관리자 패널"
          >
            <Shield className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
