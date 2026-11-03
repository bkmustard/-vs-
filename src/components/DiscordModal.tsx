import React, { useEffect, useState } from 'react';
import { fetchDiscordStatus, syncDiscordSerial, redeemDiscordCoupon, PlayerData } from '../api.js';
import { X, CheckCircle, AlertTriangle, Copy, Check, RotateCcw, Ticket, Coins, Link2 } from 'lucide-react';

interface DiscordModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: PlayerData | null;
  lives: number;
  onTicketRedeemed: () => number;
  onPlayerUpdated: (updated: PlayerData) => void;
}

export const DiscordModal: React.FC<DiscordModalProps> = ({
  isOpen,
  onClose,
  player,
  lives,
  onTicketRedeemed,
  onPlayerUpdated,
}) => {
  const [statusData, setStatusData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmittingCoupon, setIsSubmittingCoupon] = useState(false);

  const serial = player?.serialNumber || 'GS8-LOADING';

  const checkStatus = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDiscordStatus();
      setStatusData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      if (player?.serialNumber) {
        handleSync(false);
      }
    }
  }, [isOpen, player?.serialNumber]);

  if (!isOpen) return null;

  const handleCopySerial = () => {
    navigator.clipboard.writeText(`!게임연동 ${serial}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2200);
  };

  const handleSync = async (showManualFeedback = true) => {
    if (!player?.serialNumber) return;
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const res = await syncDiscordSerial({
        serial: player.serialNumber,
        playerId: player.id,
      });

      if (res.player) {
        onPlayerUpdated(res.player);
      }

      if (showManualFeedback) {
        if (res.account.linked) {
          setSyncMessage(`디스코드 [${res.account.discordUsername}] 계정과 연동되었습니다! (이벤트 칩: ${res.account.eventChips.toLocaleString()}개)`);
        } else {
          setSyncMessage('아직 디스코드에서 !게임연동 명령어가 입력되지 않았습니다.');
        }
      }
    } catch (err: any) {
      if (showManualFeedback) {
        setSyncMessage(err.message || '연동 상태 확인 실패');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    if (lives >= 10) {
      setCouponMsg({ type: 'error', text: '목숨이 이미 10개입니다. 먼저 게임을 플레이해 주세요.' });
      return;
    }
    setIsSubmittingCoupon(true);
    setCouponMsg(null);

    try {
      const res = await redeemDiscordCoupon({
        serial,
        code: couponCode.trim(),
      });

      if (res.success) {
        const addedLives = onTicketRedeemed();
        setCouponMsg({ type: 'success', text: `쿠폰 등록 성공! 목숨 +${addedLives}개 (${Math.min(10, lives + addedLives)}/10)` });
        setCouponCode('');
        handleSync(false);
      } else {
        setCouponMsg({ type: 'error', text: res.error || '쿠폰 등록에 실패했습니다.' });
      }
    } catch (err: any) {
      setCouponMsg({ type: 'error', text: err.message || '네트워크 오류' });
    } finally {
      setIsSubmittingCoupon(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </div>
          <div>
            <h2 className="font-['Black_Han_Sans'] text-2xl text-white">디스코드 경제 봇 연동</h2>
            <p className="text-xs text-slate-400">
              디스코드 서버 봇(<code className="text-indigo-300">https://economybot-yu.fly.dev</code>)과 실시간 연동
            </p>
          </div>
        </div>

        {/* Live Bot Connection Status */}
        <div className="mb-5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">봇 서버 헬스체크:</span>
            {statusData?.botHealth?.online ? (
              <span className="flex items-center gap-1 font-bold text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
                정상 연결 (HTTP 200)
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                응답 확인 중
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] text-indigo-300">
            {statusData?.botHealth?.service || 'giban-stars-game-api'}
          </span>
        </div>

        {/* Player Serial Number Box */}
        <div className="mb-5 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 to-slate-950 p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
              내 게임 계정 일련번호
            </span>
            {player?.isDiscord ? (
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                연동 완료
              </span>
            ) : (
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-400">
                미연동 상태
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-xl border border-indigo-500/40 bg-slate-950 px-4 py-2.5 font-mono text-lg font-black tracking-widest text-white shadow-inner">
              {serial}
            </div>
            <button
              onClick={handleCopySerial}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
            >
              {isCopied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
              {isCopied ? '명령어 복사됨!' : '명령어 복사'}
            </button>
          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            * <strong>명령어 복사</strong>를 누른 후 디스코드 채팅창에 붙여넣기(<code>!게임연동 {serial}</code>)하세요.
          </p>
        </div>

        {/* Discord Account & Real Event Chip Balance */}
        <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-slate-400 block mb-0.5">연동된 디스코드 사용자</span>
              <strong className="text-sm text-white">
                {player?.isDiscord ? (player.discordUsername || '디스코드 사용자') : '아직 연결되지 않음'}
              </strong>
            </div>

            <button
              onClick={() => handleSync(true)}
              disabled={isSyncing}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
              연동 확인 / 새로고침
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-400" />
              <span className="text-slate-300">디스코드 봇 지갑 이벤트 칩:</span>
            </div>
            <div className="font-['Black_Han_Sans'] text-xl text-amber-300">
              {player?.discordEventChips !== undefined ? player.discordEventChips.toLocaleString() : 0}개
            </div>
          </div>

          {syncMessage && (
            <p className="mt-2 text-[11px] font-semibold text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
              {syncMessage}
            </p>
          )}
        </div>

        {/* Coupon Redeem Section */}
        <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Ticket className="h-4 w-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white">
              총괄 게임 쿠폰 등록 (목숨 충전)
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            총괄/서버 관리자가 <code>!게임쿠폰발급</code> 명령어로 DM 발급한 쿠폰(<code>GS8-...</code>)을 입력하세요.
          </p>

          <form onSubmit={handleRedeemCoupon} className="flex gap-2">
            <input
              type="text"
              placeholder="GS8-XXXXXXXXXX"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none uppercase"
            />
            <button
              type="submit"
              disabled={isSubmittingCoupon || lives >= 10}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {isSubmittingCoupon ? '확인 중...' : '쿠폰 등록'}
            </button>
          </form>

          {couponMsg && (
            <p className={`mt-2 text-xs font-semibold ${couponMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {couponMsg.text}
            </p>
          )}
        </div>

        {/* 3-Step Simple Guide */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
          <h4 className="font-bold text-white mb-2 flex items-center gap-1.5">
            <Link2 className="h-4 w-4 text-indigo-400" />
            간단 3단계 연동 방법
          </h4>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
            <li>상단의 <strong className="text-indigo-300">[명령어 복사]</strong> 버튼을 누릅니다.</li>
            <li>디스코드 서버 채널에 붙여넣어 <code>!게임연동 {serial}</code>을 전송합니다.</li>
            <li>본 창으로 돌아와 <strong className="text-white">[연동 확인 / 새로고침]</strong>을 누르면 즉시 연동됩니다.</li>
          </ol>
          <p className="mt-2 text-[10px] text-slate-500">
            * 연동 후 게임 플레이를 완료하면 획득한 이벤트 칩이 봇 지갑으로 실시간 지급되며 Discord DM 알림을 받게 됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};
