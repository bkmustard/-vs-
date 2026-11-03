import React, { useEffect, useState } from 'react';
import { fetchLeaderboard, LeaderboardResponse, PlayerData } from '../api.js';
import { X, Trophy, Medal, RotateCcw } from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'OVERALL' | 'ANGEL' | 'DEVIL'>('OVERALL');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    setIsLoading(true);
    fetchLeaderboard()
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentList: PlayerData[] =
    tab === 'OVERALL'
      ? data?.overall || []
      : tab === 'ANGEL'
      ? data?.angel || []
      : data?.devil || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-3xl border-4 border-slate-900 bg-slate-900 p-6 shadow-[8px_8px_0px_#000000]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl border-2 border-black bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white shadow-[2px_2px_0px_#000]"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b-4 border-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 border-3 border-black text-slate-950 shadow-[3px_3px_0px_#000]">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-['Black_Han_Sans'] text-2xl sm:text-3xl text-white drop-shadow">명예의 전당 (실시간 랭킹)</h2>
              <p className="text-xs font-bold text-slate-400">실제 게임을 완료한 참가자들의 누적 점수 순위</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-xl border-2 border-black bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-200 shadow-[2px_2px_0px_#000] hover:bg-slate-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {/* Tabs */}
        <div className="my-4 flex rounded-2xl bg-slate-950 p-1.5 border-3 border-black shadow-[3px_3px_0px_#000]">
          <button
            onClick={() => setTab('OVERALL')}
            className={`flex-1 rounded-xl py-2 text-xs font-['Black_Han_Sans'] transition-all ${
              tab === 'OVERALL'
                ? 'bg-amber-400 text-slate-950 shadow-[2px_2px_0px_#000] border-2 border-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            전체 개인 랭킹
          </button>
          <button
            onClick={() => setTab('ANGEL')}
            className={`flex-1 rounded-xl py-2 text-xs font-['Black_Han_Sans'] transition-all ${
              tab === 'ANGEL'
                ? 'bg-sky-400 text-slate-950 shadow-[2px_2px_0px_#000] border-2 border-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            천사 진영 랭킹
          </button>
          <button
            onClick={() => setTab('DEVIL')}
            className={`flex-1 rounded-xl py-2 text-xs font-['Black_Han_Sans'] transition-all ${
              tab === 'DEVIL'
                ? 'bg-rose-500 text-white shadow-[2px_2px_0px_#000] border-2 border-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            악마 진영 랭킹
          </button>
        </div>

        {/* Leaderboard Table */}
        <div className="flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-16 text-center text-xs font-bold text-slate-400">랭킹 불러오는 중...</div>
          ) : currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Medal className="h-10 w-10 text-slate-600 mb-2" />
              <p className="text-sm font-black text-slate-300">아직 등록된 공식 플레이 기록이 없습니다.</p>
              <p className="text-xs font-bold text-slate-500 mt-1">
                첫 번째 주자가 되어 무한 질주를 완주해 보세요!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {currentList.map((playerItem, idx) => {
                const isAngel = playerItem.faction === 'ANGEL';
                const rank = idx + 1;
                return (
                  <div
                    key={playerItem.id}
                    className="flex items-center justify-between rounded-2xl border-2 border-black bg-slate-950 p-3.5 shadow-[3px_3px_0px_#000] transition-colors hover:border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank Medal / Badge */}
                      <div className="flex h-8 w-8 items-center justify-center font-['Black_Han_Sans'] text-sm">
                        {rank === 1 ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black">
                            1
                          </span>
                        ) : rank === 2 ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-300 text-slate-900 border-2 border-black shadow-[2px_2px_0px_#000] font-black">
                            2
                          </span>
                        ) : rank === 3 ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-700 text-amber-100 border-2 border-black shadow-[2px_2px_0px_#000] font-black">
                            3
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold">{rank}</span>
                        )}
                      </div>

                      {/* Faction Icon */}
                      <img
                        src={isAngel ? '/assets/angel.png' : '/assets/devil.png'}
                        alt={playerItem.faction}
                        className="h-9 w-9 object-contain"
                      />

                      {/* Nickname & Faction */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-white">
                            {playerItem.nickname}
                          </span>
                          {playerItem.isDiscord && playerItem.discordUsername && (
                            <span className="text-xs font-bold text-indigo-400">
                              @{playerItem.discordUsername}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-black ${
                            isAngel ? 'text-sky-400' : 'text-rose-400'
                          }`}
                        >
                          {isAngel ? '천사 진영' : '악마 진영'} • {playerItem.playCount}회 출격
                        </span>
                      </div>
                    </div>

                    {/* Scores */}
                    <div className="text-right">
                      <div className="font-['Black_Han_Sans'] text-base text-amber-300">
                        {playerItem.totalScore.toLocaleString()}P
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">
                        최고 {playerItem.highScore.toLocaleString()}P
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
