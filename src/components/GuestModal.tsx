import React, { useState } from 'react';
import { generateRandomNickname } from '../utils/nickname.js';
import { Sparkles, Dices, X, CheckCircle2, Lock, ShieldAlert } from 'lucide-react';
import { PlayerData } from '../api.js';

interface GuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuestRegistered: (player: PlayerData) => void;
  initialPlayer: PlayerData | null;
}

export const GuestModal: React.FC<GuestModalProps> = ({
  isOpen,
  onClose,
  onGuestRegistered,
  initialPlayer,
}) => {
  const isFactionLocked = Boolean(
    initialPlayer?.factionLocked || (typeof window !== 'undefined' && localStorage.getItem('kiban_faction_locked') === 'true')
  );

  const [nickname, setNickname] = useState<string>(
    initialPlayer?.nickname || generateRandomNickname()
  );
  const [selectedFaction, setSelectedFaction] = useState<'ANGEL' | 'DEVIL'>(
    initialPlayer?.faction || 'ANGEL'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleReroll = () => {
    setNickname(generateRandomNickname());
  };

  const handleSelectFaction = (faction: 'ANGEL' | 'DEVIL') => {
    if (isFactionLocked) {
      return; // Locked permanently
    }
    setSelectedFaction(faction);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setErrorMsg('닉네임을 입력하거나 무작위 생성해 주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      // Retrieve existing guestId from localStorage or create new
      const savedGuestId = localStorage.getItem('kiban_guest_id') || undefined;

      const res = await fetch('/api/player/guest-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: savedGuestId,
          nickname: nickname.trim(),
          faction: selectedFaction,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '게스트 등록에 실패했습니다.');
      }

      // Persist lock in localStorage
      localStorage.setItem('kiban_guest_id', data.player.id);
      localStorage.setItem('kiban_current_player_id', data.player.id);
      localStorage.setItem('kiban_faction_locked', 'true');
      localStorage.setItem('kiban_locked_faction', data.player.faction);

      onGuestRegistered(data.player);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || '오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-4 border-slate-900 bg-slate-900 p-6 shadow-[8px_8px_0px_#000000]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl border-2 border-black bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white shadow-[2px_2px_0px_#000]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 border-3 border-black shadow-[3px_3px_0px_#000]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="font-['Black_Han_Sans'] text-2xl text-white drop-shadow">
            {isFactionLocked ? '플레이어 프로필 설정' : '로그인 및 진영 선택'}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {isFactionLocked
              ? '소속 진영이 확정되었습니다. 닉네임만 변경할 수 있습니다.'
              : '닉네임과 진영을 선택한 뒤 로그인하세요. 진영은 확정 후 변경할 수 없습니다.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nickname Generation */}
          <div>
            <label className="block text-xs font-black text-slate-200 mb-1.5 flex items-center gap-1.5">
              <span>플레이어 닉네임</span>
              <span className="text-[10px] text-amber-400 font-bold">[수식어 + 고정 이름]</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                required
                className="flex-1 rounded-xl border-3 border-black bg-slate-950 px-3.5 py-2.5 text-sm font-bold text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none shadow-[3px_3px_0px_#000]"
              />
              <button
                type="button"
                onClick={handleReroll}
                className="flex items-center gap-1.5 rounded-xl border-3 border-black bg-amber-400 px-3.5 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] shadow-[3px_3px_0px_#000] transition-all"
                title="무작위 닉네임 재생성"
              >
                <Dices className="h-4 w-4" />
                재생성
              </button>
            </div>
          </div>

          {/* Faction Choice */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black text-slate-200">
                소속 진영 {isFactionLocked ? '(확정됨)' : '(최초 1회 선택)'}
              </label>
              {isFactionLocked ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                  <Lock className="h-3 w-3" /> 변경 불가
                </span>
              ) : (
                <span className="text-[10px] font-bold text-rose-400">
                  * 1회 선택 후 영구 고정
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Angel Faction */}
              <button
                type="button"
                onClick={() => handleSelectFaction('ANGEL')}
                disabled={isFactionLocked && selectedFaction !== 'ANGEL'}
                className={`relative flex flex-col items-center gap-2 rounded-2xl border-3 p-4 text-center transition-all ${
                  selectedFaction === 'ANGEL'
                    ? 'border-sky-400 bg-sky-950/80 shadow-[4px_4px_0px_#0284c7] ring-2 ring-sky-400/40'
                    : isFactionLocked
                    ? 'border-slate-800 bg-slate-950/40 opacity-30 cursor-not-allowed'
                    : 'border-black bg-slate-950/80 opacity-60 hover:opacity-100 hover:border-sky-400 shadow-[3px_3px_0px_#000]'
                }`}
              >
                {selectedFaction === 'ANGEL' && (
                  <div className="absolute right-2 top-2 flex items-center justify-center rounded-full bg-sky-400 p-0.5 text-black">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                )}
                {isFactionLocked && selectedFaction !== 'ANGEL' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl backdrop-blur-[1px]">
                    <Lock className="h-6 w-6 text-slate-500" />
                  </div>
                )}
                <img src="/assets/angel.png" alt="천사" className="h-14 w-14 object-contain drop-shadow" />
                <div>
                  <span className="block font-['Black_Han_Sans'] text-base text-sky-300">
                    천사 진영
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">ANGEL TEAM</span>
                </div>
              </button>

              {/* Devil Faction */}
              <button
                type="button"
                onClick={() => handleSelectFaction('DEVIL')}
                disabled={isFactionLocked && selectedFaction !== 'DEVIL'}
                className={`relative flex flex-col items-center gap-2 rounded-2xl border-3 p-4 text-center transition-all ${
                  selectedFaction === 'DEVIL'
                    ? 'border-rose-500 bg-rose-950/80 shadow-[4px_4px_0px_#b91c1c] ring-2 ring-rose-500/40'
                    : isFactionLocked
                    ? 'border-slate-800 bg-slate-950/40 opacity-30 cursor-not-allowed'
                    : 'border-black bg-slate-950/80 opacity-60 hover:opacity-100 hover:border-rose-500 shadow-[3px_3px_0px_#000]'
                }`}
              >
                {selectedFaction === 'DEVIL' && (
                  <div className="absolute right-2 top-2 flex items-center justify-center rounded-full bg-rose-500 p-0.5 text-black">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                )}
                {isFactionLocked && selectedFaction !== 'DEVIL' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl backdrop-blur-[1px]">
                    <Lock className="h-6 w-6 text-slate-500" />
                  </div>
                )}
                <img src="/assets/devil.png" alt="악마" className="h-14 w-14 object-contain drop-shadow" />
                <div>
                  <span className="block font-['Black_Han_Sans'] text-base text-rose-400">
                    악마 진영
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">DEVIL TEAM</span>
                </div>
              </button>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs font-black text-rose-400 text-center bg-rose-950/50 p-2 rounded-xl border border-rose-800">
              {errorMsg}
            </p>
          )}

          {isFactionLocked ? (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl border-3 border-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 py-3.5 text-base font-['Black_Han_Sans'] text-slate-950 shadow-[4px_4px_0px_#000] hover:scale-[1.02] disabled:opacity-50 transition-all"
            >
              {isSubmitting ? '저장 중...' : '프로필 저장'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl border-3 border-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 py-3.5 text-sm font-['Black_Han_Sans'] text-slate-950 shadow-[4px_4px_0px_#000] hover:scale-[1.02] disabled:opacity-50 transition-all"
            >
              {isSubmitting ? '로그인 중...' : '로그인하기'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
