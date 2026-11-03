/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchFactionScores,
  fetchCurrentPlayer,
  initGuestPlayer,
  startGameSession,
  finishGameSession,
  FactionScoresResponse,
  PlayerData,
  PlayRecord,
} from './api.js';
import { generateRandomNickname } from './utils/nickname.js';
import { sfx } from './utils/audio.js';
import { GameMetrics } from './game/RunnerGame.js';

// Components
import { Header } from './components/Header.js';
import { MainScoreboard } from './components/MainScoreboard.js';
import { GameView } from './components/GameView.js';
import { GuestModal } from './components/GuestModal.js';
import { DiscordModal } from './components/DiscordModal.js';
import { LeaderboardModal } from './components/LeaderboardModal.js';
import { DevPanelModal } from './components/DevPanelModal.js';
import { GameOverModal } from './components/GameOverModal.js';

import {
  Play,
  Trophy,
  Users,
  Sparkles,
  Flame,
  ArrowRight,
  ShieldAlert,
  Coins,
  Compass,
  Lock,
} from 'lucide-react';

export default function App() {
  // App views: 'MAIN' | 'PLAYING'
  const [currentView, setCurrentView] = useState<'MAIN' | 'PLAYING'>('MAIN');

  // Player State
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [scores, setScores] = useState<FactionScoresResponse | null>(null);

  // Active Game Session
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [gameKey, setGameKey] = useState<number>(0);
  const [lastFinishedRecord, setLastFinishedRecord] = useState<PlayRecord | null>(null);
  const [lastChipsAwarded, setLastChipsAwarded] = useState<number>(0);

  // Modals
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isDiscordModalOpen, setIsDiscordModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(false);

  // Audio mute
  const [isMuted, setIsMuted] = useState(false);

  // Developer Test Mode
  const [isTestMode, setIsTestMode] = useState(false);
  const [devTestFaction, setDevTestFaction] = useState<'ANGEL' | 'DEVIL'>('ANGEL');

  // Load scores & initialize player
  const loadScores = useCallback(async () => {
    try {
      const data = await fetchFactionScores();
      setScores(data);
    } catch (err) {
      console.warn('Failed to fetch faction scores:', err);
    }
  }, []);

  useEffect(() => {
    setIsMuted(sfx.getMuted());
    loadScores();

    // Check URL parameters for Discord OAuth return
    const urlParams = new URLSearchParams(window.location.search);
    const discordPlayerId = urlParams.get('playerId');
    if (discordPlayerId) {
      localStorage.setItem('kiban_current_player_id', discordPlayerId);
      localStorage.setItem('kiban_faction_locked', 'true');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if player has selected faction yet
    const savedPlayerId = localStorage.getItem('kiban_current_player_id');
    const isFactionLocked = localStorage.getItem('kiban_faction_locked') === 'true';

    if (savedPlayerId) {
      fetchCurrentPlayer(savedPlayerId)
        .then((res) => {
          setPlayer(res.player);
          if (!isFactionLocked && !res.player.factionLocked) {
            setIsGuestModalOpen(true);
          }
        })
        .catch(() => {
          localStorage.removeItem('kiban_current_player_id');
          promptInitialGuestRegistration();
        });
    } else {
      promptInitialGuestRegistration();
    }

    // Polling refresh faction scores every 12 seconds
    const interval = setInterval(loadScores, 12000);
    return () => clearInterval(interval);
  }, [loadScores]);

  const promptInitialGuestRegistration = async () => {
    try {
      const defaultNick = generateRandomNickname();
      const res = await initGuestPlayer({
        nickname: defaultNick,
        faction: 'ANGEL',
      });
      setPlayer(res.player);
      localStorage.setItem('kiban_guest_id', res.player.id);
      localStorage.setItem('kiban_current_player_id', res.player.id);
      // Open modal on first launch so user can choose their faction!
      setIsGuestModalOpen(true);
    } catch (err) {
      console.error('Failed to create initial guest:', err);
    }
  };

  const handleToggleMute = () => {
    const muted = sfx.toggleMute();
    setIsMuted(muted);
  };

  // Start Infinite Runner Game
  const handleStartGame = async () => {
    const isFactionLocked = Boolean(
      player?.factionLocked || localStorage.getItem('kiban_faction_locked') === 'true'
    );

    // If player hasn't locked in their faction yet, require them to choose first!
    if (!isTestMode && (!player || !isFactionLocked)) {
      setIsGuestModalOpen(true);
      return;
    }

    try {
      const playerId = player ? player.id : 'dev_test_player';
      const sessionRes = await startGameSession(playerId, isTestMode);
      setActiveSessionId(sessionRes.sessionId);
      setGameKey((prev) => prev + 1);
      setCurrentView('PLAYING');
    } catch (err: any) {
      alert(err.message || '게임을 시작할 수 없습니다.');
    }
  };

  // Handle Game Over
  const handleGameOver = async (metrics: GameMetrics) => {
    const sessionId = activeSessionId;
    setActiveSessionId(null);

    // Calculate estimated chips locally for instant feedback
    const divisor = scores?.eventConfig?.chipScoreDivisor || 150;
    const baseChips = Math.floor(metrics.score / divisor);
    const estimatedChips = Math.min(50, baseChips + Math.max(0, metrics.chipsCollected));

    // Immediately prepare and open Game Over modal so it ALWAYS appears reliably without lag
    const localRecord: PlayRecord = {
      id: `rec_${Date.now()}`,
      sessionId: sessionId || `direct_${Date.now()}`,
      playerId: player ? player.id : 'guest',
      playerNickname: player ? player.nickname : '게스트',
      faction: activeFaction,
      score: metrics.score,
      distance: metrics.distance,
      durationSeconds: metrics.durationSeconds,
      chipsAwarded: estimatedChips,
      chipsCollectedInGame: metrics.chipsCollected,
      jumpsCount: metrics.jumpsCount,
      slidesCount: metrics.slidesCount,
      isTestPlay: isTestMode,
      rewardStatus: player?.isDiscord ? 'DISBURSED_BOT' : 'LOCAL_STORED',
      timestamp: new Date().toISOString(),
    };

    setLastFinishedRecord(localRecord);
    setLastChipsAwarded(estimatedChips);
    setIsGameOverModalOpen(true);

    // Immediately reflect in local player state so stats are updated instantly
    if (player && !isTestMode) {
      setPlayer((prev) =>
        prev
          ? {
              ...prev,
              totalScore: prev.totalScore + metrics.score,
              highScore: Math.max(prev.highScore, metrics.score),
              totalDistance: prev.totalDistance + metrics.distance,
              totalChipsEarned: prev.totalChipsEarned + estimatedChips,
              playCount: prev.playCount + 1,
            }
          : null
      );
    }

    try {
      const playerId = player ? player.id : 'dev_test_player';
      const result = await finishGameSession({
        sessionId: sessionId || `direct_${Date.now()}`,
        playerId,
        score: metrics.score,
        distance: metrics.distance,
        durationSeconds: metrics.durationSeconds,
        chipsCollectedInGame: metrics.chipsCollected,
        jumpsCount: metrics.jumpsCount,
        slidesCount: metrics.slidesCount,
        isTestPlay: isTestMode,
      });

      // Update with server confirmed data seamlessly
      setLastFinishedRecord(result.record);
      setLastChipsAwarded(result.chipsAwarded);
      if (result.player) {
        setPlayer(result.player);
      }
      if (result.factionScores) {
        setScores(result.factionScores);
      }
      // Re-fetch scores & leaderboard to guarantee immediate reflection!
      loadScores();
    } catch (err: any) {
      console.warn('Game session finish sync warning:', err);
      // Re-fetch scores anyway to ensure consistency
      loadScores();
    }
  };

  const handleRetryGame = () => {
    setIsGameOverModalOpen(false);
    handleStartGame();
  };

  const handleGoHome = () => {
    setIsGameOverModalOpen(false);
    setCurrentView('MAIN');
    loadScores();
  };

  // Current playing faction
  const activeFaction = isTestMode ? devTestFaction : player?.faction || 'ANGEL';
  const isFactionLocked = Boolean(
    player?.factionLocked || (typeof window !== 'undefined' && localStorage.getItem('kiban_faction_locked') === 'true')
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Noto_Sans_KR']">
      {/* Universal Header */}
      <Header
        player={player}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenGuestModal={() => setIsGuestModalOpen(true)}
        onOpenDiscordModal={() => setIsDiscordModalOpen(true)}
        onOpenDevModal={() => setIsDevModalOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isTestMode={isTestMode}
      />

      {/* Main Content View Switcher */}
      {currentView === 'PLAYING' ? (
        <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
          <GameView
            key={gameKey}
            faction={activeFaction}
            player={player}
            onGameOver={handleGameOver}
            onQuit={() => {
              if (confirm('게임을 중단하고 메인으로 돌아가시겠습니까? (현재 점수는 저장되지 않습니다)')) {
                setActiveSessionId(null);
                sfx.stopBgm();
                setCurrentView('MAIN');
              }
            }}
            isTestMode={isTestMode}
          />
        </main>
      ) : (
        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 space-y-8 animate-in fade-in duration-300">
          {/* Hero Banner with Big Logo - Cartoon Arcade Style */}
          <section className="relative overflow-hidden rounded-3xl border-4 border-slate-900 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-6 sm:p-10 text-center shadow-[8px_8px_0px_#000000]">
            {/* Ambient Backlight */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-96 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative mx-auto flex flex-col items-center">
              {/* Star Logo */}
              <div className="relative mb-4">
                <img
                  src="/assets/logo.png"
                  alt="천사 vs 악마 기반스타즈"
                  className="h-28 w-28 sm:h-36 sm:w-36 object-contain drop-shadow-[0_0_24px_rgba(250,204,21,0.5)] transition-transform hover:scale-105 duration-300"
                />
              </div>

              {/* Title */}
              <h2 className="font-['Black_Han_Sans'] text-3xl sm:text-5xl tracking-wide text-white drop-shadow-md">
                천사 <span className="text-amber-400">VS</span> 악마
              </h2>
              <div className="mt-2.5 inline-flex items-center gap-2 rounded-xl border-2 border-black bg-amber-400 px-4 py-1 text-xs font-black tracking-widest text-slate-950 shadow-[3px_3px_0px_#000]">
                <span>기반스타즈 S8 대항전</span>
                <span>•</span>
                <span>무한 질주 웹게임</span>
              </div>

              <p className="mt-4 max-w-xl text-xs sm:text-sm text-slate-300 leading-relaxed font-bold">
                천사와 악마, 두 진영의 자존심을 건 무한 질주 레이스! 장애물을 돌파하며 최고 점수를 획득하고,
                소속 진영의 승리와 <strong>이벤트 칩</strong>을 쟁취하세요.
              </p>

              {/* Big CTA Action Row with Chunky 3D Cartoon Buttons */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                <button
                  onClick={handleStartGame}
                  className="group relative flex items-center gap-3 rounded-2xl border-4 border-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 px-8 py-4 font-['Black_Han_Sans'] text-xl sm:text-2xl text-slate-950 shadow-[6px_6px_0px_#000] hover:scale-105 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] transition-all"
                >
                  <Play className="h-6 w-6 fill-slate-950" />
                  무한 질주 게임 시작!
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="flex items-center gap-2 rounded-2xl border-3 border-black bg-slate-900 px-6 py-4 text-sm font-['Black_Han_Sans'] text-slate-200 shadow-[4px_4px_0px_#000] hover:bg-slate-800 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] transition-all"
                >
                  <Trophy className="h-5 w-5 text-amber-400" />
                  실시간 랭킹 보기
                </button>
              </div>
            </div>
          </section>

          {/* Faction Scoreboard Tug of War */}
          <MainScoreboard scores={scores} onRefresh={loadScores} />

          {/* Player Personal Status & Quick Setup Card */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Player Card */}
            <div className="rounded-3xl border-3 border-black bg-slate-900 p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    내 플레이어 프로필
                  </span>
                  <button
                    onClick={() => setIsGuestModalOpen(true)}
                    className="text-[11px] font-black text-amber-400 hover:underline flex items-center gap-1"
                  >
                    {isFactionLocked ? '닉네임 변경' : '진영 선택'}
                    {isFactionLocked && <Lock className="h-3 w-3" />}
                  </button>
                </div>

                {player ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={activeFaction === 'ANGEL' ? '/assets/angel.png' : '/assets/devil.png'}
                      alt={activeFaction}
                      className="h-14 w-14 object-contain drop-shadow"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-['Black_Han_Sans'] text-lg text-white leading-tight">
                          {player.nickname}
                        </h4>
                        {isTestMode && (
                          <span className="rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] font-black text-black border border-black shadow">
                            TEST
                          </span>
                        )}
                        {player.isDiscord && player.discordUsername && (
                          <span className="text-xs font-bold text-indigo-400">
                            @{player.discordUsername}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xs font-black inline-flex items-center gap-1 mt-0.5 ${
                          activeFaction === 'ANGEL' ? 'text-sky-300' : 'text-rose-400'
                        }`}
                      >
                        {activeFaction === 'ANGEL' ? '천사 진영' : '악마 진영'} {isTestMode ? '(테스트 중)' : '소속'}
                        {isFactionLocked && <Lock className="h-3 w-3 text-slate-400" />}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-bold">프로필 불러오는 중...</p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t-2 border-slate-800 pt-3 text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">내 누적 점수</span>
                  <strong className="text-sm font-['Black_Han_Sans'] text-amber-300">
                    {player ? player.totalScore.toLocaleString() : 0}P
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">최고 기록</span>
                  <strong className="text-sm font-['Black_Han_Sans'] text-white">
                    {player ? player.highScore.toLocaleString() : 0}P
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">획득 칩</span>
                  <strong className="text-sm font-['Black_Han_Sans'] text-amber-400">
                    +{player ? player.totalChipsEarned : 0}개
                  </strong>
                </div>
              </div>
            </div>

            {/* Event Currency (이벤트 칩) Card */}
            <div className="rounded-3xl border-3 border-black bg-slate-900 p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="h-5 w-5 text-amber-400" />
                  <h4 className="font-['Black_Han_Sans'] text-base text-white">
                    재화: 이벤트 칩 시스템
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-bold">
                  게임 중 획득한 점수와 주행 중 습득한 칩에 비례하여 <strong>이벤트 칩</strong>이 지급됩니다.
                  디스코드 경제 봇과 실시간 연동되어 서버 지갑으로 안전하게 적립됩니다.
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-950 p-2.5 text-xs text-slate-300 border-2 border-black shadow-[2px_2px_0px_#000]">
                <span className="font-bold">지급 비율:</span>
                <span className="font-black text-amber-300">
                  {scores?.eventConfig?.chipScoreDivisor || 150}점당 1칩 + 수집 보너스
                </span>
              </div>
            </div>

            {/* Community & Discord Bot Card */}
            <div className="rounded-3xl border-3 border-black bg-slate-900 p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-['Black_Han_Sans'] text-base text-white">
                    디스코드 연동 지원
                  </h4>
                  <span className="flex items-center gap-1 text-[11px] font-black text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    봇 API 연동
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-bold">
                  Fly.io에서 호스팅 중인 Python 경제 봇과 연동하여 디스코드 계정 진영을 조회하고 재화를 자동 수령할 수 있습니다.
                </p>
              </div>

              <button
                onClick={() => setIsDiscordModalOpen(true)}
                className="mt-3 w-full rounded-2xl border-2 border-black bg-indigo-900/60 py-2.5 text-xs font-black text-indigo-200 shadow-[2px_2px_0px_#000] hover:bg-indigo-850 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                연동 상태 확인 및 가이드
              </button>
            </div>
          </section>

          {/* Obstacle & Control Guide */}
          <section className="rounded-3xl border-3 border-black bg-slate-900 p-6 shadow-[4px_4px_0px_#000]">
            <h3 className="font-['Black_Han_Sans'] text-xl text-white mb-4 flex items-center gap-2">
              <Compass className="h-5 w-5 text-amber-400" />
              게임 조작 및 장애물 공략 가이드
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Obstacle 1 */}
              <div className="rounded-2xl border-2 border-black bg-slate-950 p-4 text-center shadow-[3px_3px_0px_#000]">
                <span className="inline-block rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-black text-black border border-black shadow mb-2">
                  점프로 회피
                </span>
                <h5 className="font-['Black_Han_Sans'] text-white text-sm mb-1">지면 가시</h5>
                <p className="text-xs font-bold text-slate-400">
                  바닥에 솟아오른 결정/가시. <strong>Space / ↑</strong> 키 또는 점프 버튼으로 뛰어넘으세요.
                </p>
              </div>

              {/* Obstacle 2 */}
              <div className="rounded-2xl border-2 border-black bg-slate-950 p-4 text-center shadow-[3px_3px_0px_#000]">
                <span className="inline-block rounded-lg bg-sky-400 px-2 py-0.5 text-[10px] font-black text-black border border-black shadow mb-2">
                  슬라이딩 회피
                </span>
                <h5 className="font-['Black_Han_Sans'] text-white text-sm mb-1">공중 장애물</h5>
                <p className="text-xs font-bold text-slate-400">
                  머리 높이로 날아오는 비행체. <strong>↓</strong> 키 또는 슬라이딩 버튼으로 통과하세요.
                </p>
              </div>

              {/* Obstacle 3 */}
              <div className="rounded-2xl border-2 border-black bg-slate-950 p-4 text-center shadow-[3px_3px_0px_#000]">
                <span className="inline-block rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-black text-black border border-black shadow mb-2">
                  점프로 회피
                </span>
                <h5 className="font-['Black_Han_Sans'] text-white text-sm mb-1">상자 / 제단</h5>
                <p className="text-xs font-bold text-slate-400">
                  단단한 유물 상자. 충돌하지 않도록 포물선 점프로 사뿐히 도약하세요.
                </p>
              </div>

              {/* Obstacle 4 */}
              <div className="rounded-2xl border-2 border-black bg-slate-950 p-4 text-center shadow-[3px_3px_0px_#000]">
                <span className="inline-block rounded-lg bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white border border-black shadow mb-2">
                  슬라이딩 회피
                </span>
                <h5 className="font-['Black_Han_Sans'] text-white text-sm mb-1">낮은 천장</h5>
                <p className="text-xs font-bold text-slate-400">
                  위에서 내려오는 쇠창살 천장. 몸을 숙여 슬라이딩으로 재빠르게 빠져나가세요.
                </p>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t-4 border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 font-bold">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 기반스타즈 S8: 천사 VS 악마. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDevModalOpen(true)}
              className="text-slate-400 hover:text-amber-300 transition-colors font-bold"
            >
              관리자 패널
            </button>
            <span>•</span>
            <button
              onClick={() => setIsDiscordModalOpen(true)}
              className="text-slate-400 hover:text-indigo-300 transition-colors font-bold"
            >
              Python 경제 봇 API 가이드
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <GuestModal
        isOpen={isGuestModalOpen}
        onClose={() => setIsGuestModalOpen(false)}
        onGuestRegistered={(newPlayer) => {
          setPlayer(newPlayer);
          loadScores();
        }}
        initialPlayer={player}
      />

      <DiscordModal
        isOpen={isDiscordModalOpen}
        onClose={() => setIsDiscordModalOpen(false)}
        player={player}
        onPlayerUpdated={(updatedPlayer) => {
          setPlayer(updatedPlayer);
          loadScores();
        }}
      />

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />

      <DevPanelModal
        isOpen={isDevModalOpen}
        onClose={() => setIsDevModalOpen(false)}
        onRefreshMain={loadScores}
        isTestMode={isTestMode}
        onToggleTestMode={(enabled) => setIsTestMode(enabled)}
        devTestFaction={devTestFaction}
        onChangeDevTestFaction={(f) => setDevTestFaction(f)}
        currentPlayerId={player?.id}
        onCurrentPlayerUpdated={(updated) => setPlayer(updated)}
      />

      <GameOverModal
        isOpen={isGameOverModalOpen}
        record={lastFinishedRecord}
        player={player}
        chipsAwarded={lastChipsAwarded}
        isTestPlay={isTestMode}
        onRetry={handleRetryGame}
        onGoHome={handleGoHome}
      />
    </div>
  );
}
