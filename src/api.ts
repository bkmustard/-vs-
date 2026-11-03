export interface FactionScoresResponse {
  angel: {
    totalScore: number;
    playCount: number;
    playersCount: number;
  };
  devil: {
    totalScore: number;
    playCount: number;
    playersCount: number;
  };
  leadingFaction: 'ANGEL' | 'DEVIL' | 'TIE';
  scoreDiff: number;
  totalPlayCount: number;
  totalPlayersCount: number;
  eventConfig: {
    eventName: string;
    startTime: string;
    endTime: string;
    status: 'ACTIVE' | 'PAUSED' | 'ENDED';
    chipScoreDivisor: number;
    chipRewardCapPerGame: number;
    dailyPlayLimit: number;
  };
}

export interface PlayerData {
  id: string;
  serialNumber: string;
  nickname: string;
  faction: 'ANGEL' | 'DEVIL';
  isDiscord: boolean;
  discordId?: string;
  discordUsername?: string;
  discordEventChips?: number;
  avatarUrl?: string;
  factionLocked?: boolean;
  totalScore: number;
  highScore: number;
  totalDistance: number;
  totalChipsEarned: number;
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardResponse {
  overall: PlayerData[];
  angel: PlayerData[];
  devil: PlayerData[];
}

export interface PlayRecord {
  id: string;
  sessionId: string;
  playerId: string;
  playerNickname: string;
  faction: 'ANGEL' | 'DEVIL';
  score: number;
  distance: number;
  durationSeconds: number;
  chipsAwarded: number;
  chipsCollectedInGame: number;
  jumpsCount: number;
  slidesCount: number;
  isTestPlay: boolean;
  rewardStatus: 'LOCAL_STORED' | 'DISBURSED_BOT' | 'BOT_FAILED' | 'BOT_SKIPPED_GUEST' | 'BOT_PENDING';
  botDisburseDetails?: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

const API_BASE = '';

export async function fetchFactionScores(): Promise<FactionScoresResponse> {
  const res = await fetch(`${API_BASE}/api/factions/scores`);
  if (!res.ok) throw new Error('진영 점수를 불러오지 못했습니다.');
  return res.json();
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const res = await fetch(`${API_BASE}/api/leaderboard`);
  if (!res.ok) throw new Error('랭킹 데이터를 불러오지 못했습니다.');
  return res.json();
}

export async function initGuestPlayer(params: {
  guestId?: string;
  nickname: string;
  faction: 'ANGEL' | 'DEVIL';
}): Promise<{ player: PlayerData }> {
  const res = await fetch(`${API_BASE}/api/player/guest-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '게스트 등록에 실패했습니다.');
  }
  return res.json();
}

export async function fetchCurrentPlayer(playerId: string): Promise<{ player: PlayerData }> {
  const res = await fetch(`${API_BASE}/api/player/me?playerId=${encodeURIComponent(playerId)}`);
  if (!res.ok) throw new Error('플레이어 정보를 찾을 수 없습니다.');
  return res.json();
}

export async function startGameSession(playerId: string, isTestPlay = false): Promise<{ sessionId: string; startTime: number }> {
  const res = await fetch(`${API_BASE}/api/game/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, isTestPlay }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '게임 세션을 시작할 수 없습니다.');
  }
  return res.json();
}

export async function finishGameSession(payload: {
  sessionId: string;
  playerId: string;
  score: number;
  distance: number;
  durationSeconds: number;
  chipsCollectedInGame: number;
  jumpsCount: number;
  slidesCount: number;
  isTestPlay?: boolean;
}): Promise<{
  success: boolean;
  record: PlayRecord;
  player: PlayerData;
  chipsAwarded: number;
  isTestPlay: boolean;
  factionScores: FactionScoresResponse;
}> {
  const res = await fetch(`${API_BASE}/api/game/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '게임 기록 전송에 실패했습니다.');
  }
  return res.json();
}

export async function fetchDiscordStatus() {
  const res = await fetch(`${API_BASE}/api/discord/status`);
  if (!res.ok) throw new Error('Discord 상태 확인 실패');
  return res.json();
}

export async function fetchDiscordAuthUrl(faction: 'ANGEL' | 'DEVIL'): Promise<{ url: string; state: string }> {
  const res = await fetch(`${API_BASE}/api/discord/auth-url?faction=${encodeURIComponent(faction)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Discord 로그인 URL 생성에 실패했습니다.');
  }
  return res.json();
}

// ----------------------------------------------------------------------------
// Developer Panel APIs
// ----------------------------------------------------------------------------
export async function devAuthenticate(code: string): Promise<{ success: boolean; token: string }> {
  const res = await fetch(`${API_BASE}/api/dev/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '개발자 코드가 유효하지 않습니다.');
  }
  return res.json();
}

export async function fetchDevPlayers(token: string): Promise<{ players: PlayerData[] }> {
  const res = await fetch(`${API_BASE}/api/dev/players`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('플레이어 목록 조회 실패');
  return res.json();
}

export async function updatePlayerFaction(
  token: string,
  playerId: string,
  newFaction: 'ANGEL' | 'DEVIL'
): Promise<{ success: boolean; player: PlayerData; factionScores: FactionScoresResponse }> {
  const res = await fetch(`${API_BASE}/api/dev/player/change-faction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ playerId, newFaction }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '진영 변경에 실패했습니다.');
  }
  return res.json();
}

export async function fetchPlayerLogs(token: string, playerId: string): Promise<{ records: PlayRecord[] }> {
  const res = await fetch(`${API_BASE}/api/dev/player/${playerId}/logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('플레이어 기록 조회 실패');
  return res.json();
}

export async function resetLeaderboardServer(
  token: string,
  target: 'all' | 'angel' | 'devil'
): Promise<{ success: boolean; factionScores: FactionScoresResponse; leaderboards: LeaderboardResponse }> {
  const res = await fetch(`${API_BASE}/api/dev/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '초기화 작업에 실패했습니다.');
  }
  return res.json();
}

export async function fetchDevConfig(token: string) {
  const res = await fetch(`${API_BASE}/api/dev/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('설정 로드 실패');
  return res.json();
}

export async function updateDevConfig(token: string, config: any) {
  const res = await fetch(`${API_BASE}/api/dev/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('설정 업데이트 실패');
  return res.json();
}

export async function fetchAuditLogs(token: string): Promise<{ logs: AuditLog[] }> {
  const res = await fetch(`${API_BASE}/api/dev/audit-logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('감사 로그 조회 실패');
  return res.json();
}

export async function testBotApiLive(token: string) {
  const res = await fetch(`${API_BASE}/api/dev/test-bot-api`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function syncDiscordSerial(params: {
  serial: string;
  playerId?: string;
}): Promise<{ status: string; account: { linked: boolean; eventChips: number; discordUsername?: string }; player?: PlayerData }> {
  const res = await fetch(`${API_BASE}/api/discord/sync-serial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '일련번호 동기화에 실패했습니다.');
  }
  return res.json();
}

export async function redeemDiscordCoupon(params: {
  serial: string;
  code: string;
}): Promise<{ success: boolean; lives?: number; error?: string }> {
  const res = await fetch(`${API_BASE}/api/discord/redeem-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

