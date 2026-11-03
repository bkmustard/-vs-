import React, { useState, useEffect } from 'react';
import {
  devAuthenticate,
  fetchDevPlayers,
  updatePlayerFaction,
  fetchPlayerLogs,
  resetLeaderboardServer,
  fetchDevConfig,
  updateDevConfig,
  fetchAuditLogs,
  testBotApiLive,
  PlayerData,
  PlayRecord,
  AuditLog,
} from '../api.js';
import {
  X,
  Lock,
  ShieldAlert,
  Users,
  RotateCcw,
  Settings,
  FileText,
  Activity,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface DevPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshMain: () => void;
  isTestMode: boolean;
  onToggleTestMode: (enabled: boolean) => void;
  devTestFaction: 'ANGEL' | 'DEVIL';
  onChangeDevTestFaction: (f: 'ANGEL' | 'DEVIL') => void;
  currentPlayerId?: string;
  onCurrentPlayerUpdated?: (player: PlayerData) => void;
}

export const DevPanelModal: React.FC<DevPanelModalProps> = ({
  isOpen,
  onClose,
  onRefreshMain,
  isTestMode,
  onToggleTestMode,
  devTestFaction,
  onChangeDevTestFaction,
  currentPlayerId,
  onCurrentPlayerUpdated,
}) => {
  const [authCode, setAuthCode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'PLAYERS' | 'TEST' | 'RESET' | 'EVENT' | 'AUDIT' | 'BOT'>('PLAYERS');

  // Tab Data States
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [selectedPlayerLogs, setSelectedPlayerLogs] = useState<{ player: PlayerData; records: PlayRecord[] } | null>(null);
  const [eventConfig, setEventConfig] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [botTestResult, setBotTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState<string | null>(null);

  useEffect(() => {
    // Restore dev token from session if available
    const savedToken = sessionStorage.getItem('kiban_dev_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (isOpen && token) {
      loadTabData();
    }
  }, [isOpen, token, activeTab]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      setLoading(true);
      const res = await devAuthenticate(authCode);
      setToken(res.token);
      sessionStorage.setItem('kiban_dev_token', res.token);
      setAuthCode('');
    } catch (err: any) {
      setErrorMsg(err.message || '인증 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (activeTab === 'PLAYERS') {
        const res = await fetchDevPlayers(token);
        setPlayers(res.players);
      } else if (activeTab === 'EVENT') {
        const res = await fetchDevConfig(token);
        setEventConfig(res.config);
      } else if (activeTab === 'AUDIT') {
        const res = await fetchAuditLogs(token);
        setAuditLogs(res.logs);
      } else if (activeTab === 'BOT') {
        const res = await testBotApiLive(token);
        setBotTestResult(res.status);
      }
    } catch (err: any) {
      if (err.message?.includes('인증')) {
        setToken(null);
        sessionStorage.removeItem('kiban_dev_token');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFactionChange = async (playerItem: PlayerData, newFaction: 'ANGEL' | 'DEVIL') => {
    if (!token) return;
    try {
      const res = await updatePlayerFaction(token, playerItem.id, newFaction);
      loadTabData();
      onRefreshMain();
      if (onCurrentPlayerUpdated && playerItem.id === currentPlayerId) {
        onCurrentPlayerUpdated(res.player || { ...playerItem, faction: newFaction });
      }
    } catch (err: any) {
      alert(err.message || '진영 변경 실패');
    }
  };

  const handleViewLogs = async (player: PlayerData) => {
    if (!token) return;
    try {
      const res = await fetchPlayerLogs(token, player.id);
      setSelectedPlayerLogs({ player, records: res.records });
    } catch (err: any) {
      alert(err.message || '로그 조회 실패');
    }
  };

  const executeReset = async (target: 'all' | 'angel' | 'devil') => {
    if (!token) return;
    try {
      await resetLeaderboardServer(token, target);
      setResetConfirmation(null);
      alert('초기화가 정상 처리되었습니다.');
      loadTabData();
      onRefreshMain();
    } catch (err: any) {
      alert(err.message || '초기화 실패');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !eventConfig) return;
    try {
      await updateDevConfig(token, eventConfig);
      alert('이벤트 설정이 저장되었습니다.');
      onRefreshMain();
    } catch (err: any) {
      alert(err.message || '설정 저장 실패');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <h2 className="font-['Black_Han_Sans'] text-xl text-white">개발자 관리자 패널</h2>
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-500/30">
              SECRET CODE PROTECTED
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        {!token ? (
          /* Authentication Screen */
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock className="h-7 w-7" />
            </div>
            <h3 className="font-['Black_Han_Sans'] text-2xl text-white mb-2">개발자 인증 필요</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              서버 측 보안 검증을 위해 관리자 보안 코드를 입력해 주세요.
            </p>

            <form onSubmit={handleLogin} className="w-full max-w-xs space-y-3">
              <input
                type="password"
                placeholder="관리자 보안 코드 입력"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-center text-sm font-bold text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
              {errorMsg && <p className="text-xs font-semibold text-rose-400">{errorMsg}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                {loading ? '인증 확인 중...' : '관리자 패널 접속'}
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Dev Panel Tabs */
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Tab navigation */}
            <div className="flex flex-wrap border-b border-slate-800 bg-slate-950/70 px-4 pt-2">
              <button
                onClick={() => setActiveTab('PLAYERS')}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition-colors ${
                  activeTab === 'PLAYERS'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                플레이어 & 진영 관리
              </button>

              <button
                onClick={() => setActiveTab('TEST')}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition-colors ${
                  activeTab === 'TEST'
                    ? 'border-emerald-400 text-emerald-300'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                개발자 테스트 기능
              </button>

              <button
                onClick={() => setActiveTab('RESET')}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition-colors ${
                  activeTab === 'RESET'
                    ? 'border-rose-500 text-rose-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                리더보드 초기화
              </button>

              <button
                onClick={() => setActiveTab('EVENT')}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition-colors ${
                  activeTab === 'EVENT'
                    ? 'border-sky-400 text-sky-300'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                이벤트 규칙 설정
              </button>

              <button
                onClick={() => setActiveTab('AUDIT')}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition-colors ${
                  activeTab === 'AUDIT'
                    ? 'border-purple-400 text-purple-300'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                감사 로그
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading && <div className="py-8 text-center text-xs text-slate-400">데이터 처리 중...</div>}

              {/* 1. PLAYERS TAB */}
              {activeTab === 'PLAYERS' && !loading && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">등록된 플레이어 목록 ({players.length}명)</h4>
                    <span className="text-xs text-slate-400">
                      * 디스코드 연동 플레이어도 언제든 관리자가 진영을 재배치할 수 있습니다.
                    </span>
                  </div>

                  {players.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      아직 등록된 플레이어가 없습니다.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950">
                      {players.map((p) => (
                        <div key={p.id} className="flex flex-wrap items-center justify-between p-3.5 gap-2">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.faction === 'ANGEL' ? '/assets/angel.png' : '/assets/devil.png'}
                              alt={p.faction}
                              className="h-8 w-8 object-contain"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{p.nickname}</span>
                                {p.isDiscord ? (
                                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300 border border-indigo-500/30">
                                    Discord ({p.discordUsername || p.discordId})
                                  </span>
                                ) : (
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                    게스트 ({p.id.slice(0, 10)})
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400">
                                누적 {p.totalScore.toLocaleString()}P • 최고 {p.highScore.toLocaleString()}P •{' '}
                                {p.playCount}회 플레이 • 획득 칩 {p.totalChipsEarned}개
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Toggle Faction Buttons */}
                            <span className="text-xs text-slate-400 mr-1">진영 변경:</span>
                            <button
                              onClick={() => handleFactionChange(p, 'ANGEL')}
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                p.faction === 'ANGEL'
                                  ? 'bg-sky-500 text-white shadow'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              천사
                            </button>
                            <button
                              onClick={() => handleFactionChange(p, 'DEVIL')}
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                p.faction === 'DEVIL'
                                  ? 'bg-rose-600 text-white shadow'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              악마
                            </button>

                            {/* View Run Logs */}
                            <button
                              onClick={() => handleViewLogs(p)}
                              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 ml-2"
                            >
                              기록 보기
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Individual Player Logs Modal Layer */}
                  {selectedPlayerLogs && (
                    <div className="mt-4 rounded-xl border border-amber-500/30 bg-slate-950 p-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                        <h5 className="text-xs font-bold text-amber-300">
                          {selectedPlayerLogs.player.nickname} 님의 상세 플레이 기록 ({selectedPlayerLogs.records.length}건)
                        </h5>
                        <button
                          onClick={() => setSelectedPlayerLogs(null)}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          닫기
                        </button>
                      </div>
                      {selectedPlayerLogs.records.length === 0 ? (
                        <p className="text-xs text-slate-500">기록이 없습니다.</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                          {selectedPlayerLogs.records.map((r) => (
                            <div key={r.id} className="flex justify-between rounded bg-slate-900 p-2 text-slate-300">
                              <span>
                                {new Date(r.timestamp).toLocaleTimeString()} - 점수 {r.score}P / 거리 {r.distance}m / 칩 +{r.chipsAwarded}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {r.isTestPlay ? '[테스트]' : r.rewardStatus}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 2. TEST MODE TAB */}
              {activeTab === 'TEST' && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5">
                    <h4 className="text-base font-bold text-emerald-300 mb-1">
                      개발자 전용 테스트 플레이 모드
                    </h4>
                    <p className="text-xs text-slate-300 mb-4">
                      테스트 모드를 활성화하면 개발자 본인의 진영을 자유롭게 변경하여 게임을 실행할 수 있습니다.
                      테스트 플레이에서 획득한 점수는 <strong>실제 진영 총점 및 공식 리더보드에 일체 반영되지 않습니다.</strong>
                    </p>

                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isTestMode}
                          onChange={(e) => onToggleTestMode(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                        />
                        <span className="text-xs font-bold text-white">
                          개발자 테스트 모드 활성화 (공식 랭킹 반영 차단)
                        </span>
                      </label>

                      {isTestMode && (
                        <div className="flex flex-col gap-2 rounded-xl bg-slate-900/90 p-3 border border-emerald-500/30 w-full mt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-300">현재 테스트 진영:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onChangeDevTestFaction('ANGEL')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
                                  devTestFaction === 'ANGEL'
                                    ? 'bg-sky-500 text-white shadow-[0_0_12px_rgba(56,189,248,0.5)] ring-2 ring-sky-300'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                <img src="/assets/angel.png" alt="천사" className="h-4 w-4 object-contain" />
                                천사 (ANGEL)
                              </button>
                              <button
                                type="button"
                                onClick={() => onChangeDevTestFaction('DEVIL')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
                                  devTestFaction === 'DEVIL'
                                    ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(244,63,94,0.5)] ring-2 ring-rose-300'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                <img src="/assets/devil.png" alt="악마" className="h-4 w-4 object-contain" />
                                악마 (DEVIL)
                              </button>
                            </div>
                          </div>
                          <span className="text-[11px] text-emerald-400/90">
                            ✓ 진영 변경 즉시 적용됨: 플레이어 프로필, 캐릭터 스프라이트 및 게임 화면에 실시간 반영됩니다.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. RESET TAB */}
              {activeTab === 'RESET' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
                    <h4 className="text-sm font-bold text-rose-300 mb-1">리더보드 및 점수 초기화</h4>
                    <p className="text-xs text-slate-400">
                      초기화는 영구적으로 적용되며 서버 감사 로그에 기록됩니다. 신중하게 진행해 주세요.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => setResetConfirmation('all')}
                      className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-center hover:bg-rose-900/60 transition-colors"
                    >
                      <span className="block font-bold text-rose-300 text-sm mb-1">전체 리더보드 초기화</span>
                      <span className="text-[11px] text-slate-400">양 진영 및 모든 플레이어 점수 0으로 초기화</span>
                    </button>

                    <button
                      onClick={() => setResetConfirmation('angel')}
                      className="rounded-xl border border-sky-500/40 bg-sky-950/40 p-4 text-center hover:bg-sky-900/60 transition-colors"
                    >
                      <span className="block font-bold text-sky-300 text-sm mb-1">천사 진영만 초기화</span>
                      <span className="text-[11px] text-slate-400">천사 팀 점수 및 소속 플레이어 기록 초기화</span>
                    </button>

                    <button
                      onClick={() => setResetConfirmation('devil')}
                      className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-center hover:bg-amber-900/60 transition-colors"
                    >
                      <span className="block font-bold text-amber-300 text-sm mb-1">악마 진영만 초기화</span>
                      <span className="text-[11px] text-slate-400">악마 팀 점수 및 소속 플레이어 기록 초기화</span>
                    </button>
                  </div>

                  {resetConfirmation && (
                    <div className="mt-4 rounded-xl border border-rose-500 bg-rose-950 p-4">
                      <div className="flex items-center gap-2 text-rose-200 text-sm font-bold mb-2">
                        <AlertTriangle className="h-5 w-5 text-rose-400" />
                        정말로 [{resetConfirmation === 'all' ? '전체' : resetConfirmation === 'angel' ? '천사 진영' : '악마 진영'}] 데이터를 초기화하시겠습니까?
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => executeReset(resetConfirmation as any)}
                          className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-500"
                        >
                          예, 즉시 초기화 실행
                        </button>
                        <button
                          onClick={() => setResetConfirmation(null)}
                          className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. EVENT CONFIG TAB */}
              {activeTab === 'EVENT' && eventConfig && (
                <form onSubmit={handleSaveConfig} className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">이벤트 명칭</label>
                    <input
                      type="text"
                      value={eventConfig.eventName || ''}
                      onChange={(e) => setEventConfig({ ...eventConfig, eventName: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">이벤트 종료 일시</label>
                      <input
                        type="datetime-local"
                        value={eventConfig.endTime ? new Date(eventConfig.endTime).toISOString().slice(0, 16) : ''}
                        onChange={(e) => setEventConfig({ ...eventConfig, endTime: new Date(e.target.value).toISOString() })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">진행 상태</label>
                      <select
                        value={eventConfig.status || 'ACTIVE'}
                        onChange={(e) => setEventConfig({ ...eventConfig, status: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white"
                      >
                        <option value="ACTIVE">진행 중 (ACTIVE)</option>
                        <option value="PAUSED">일시 중단 (PAUSED)</option>
                        <option value="ENDED">종료됨 (ENDED)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        칩 환산 점수 (점수 나누기 값)
                      </label>
                      <input
                        type="number"
                        value={eventConfig.chipScoreDivisor || 1500}
                        onChange={(e) => setEventConfig({ ...eventConfig, chipScoreDivisor: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white"
                      />
                      <span className="text-[10px] text-slate-400">예: 1,500점당 1 이벤트 칩 지급</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        1판당 칩 최대 지급 상한
                      </label>
                      <input
                        type="number"
                        value={eventConfig.chipRewardCapPerGame || 5}
                        onChange={(e) => setEventConfig({ ...eventConfig, chipRewardCapPerGame: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white"
                      />
                      <span className="text-[10px] text-slate-400">게임 1회당 수령 가능한 최대 칩</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-400 shadow"
                  >
                    설정값 저장
                  </button>
                </form>
              )}

              {/* 5. AUDIT LOGS TAB */}
              {activeTab === 'AUDIT' && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white mb-2">관리자 감사 로그</h4>
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-slate-500">기록된 로그가 없습니다.</p>
                  ) : (
                    <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950 max-h-96 overflow-y-auto">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="p-3 text-xs">
                          <div className="flex justify-between font-mono text-[11px] text-slate-400 mb-1">
                            <span className="font-bold text-amber-300">{log.action}</span>
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-300">{log.details}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
