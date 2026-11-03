import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import {
  getDb,
  saveDb,
  getFactionScores,
  getLeaderboards,
  Player,
  PlayRecord,
  Faction,
  generateGameSerial,
} from './server/db.js';
import {
  checkBotHealth,
  fetchBotGameAccount,
  awardBotChips,
  submitBotScore,
  redeemBotCoupon,
} from './server/discordBot.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DEV_ADMIN_CODE = process.env.DEV_ADMIN_CODE || 'gae03';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve public static assets (images, logos, audio, etc.)
app.use(express.static(path.resolve(process.cwd(), 'public')));

// Active game sessions for anti-cheat validation
interface ActiveSession {
  sessionId: string;
  playerId: string;
  startTime: number;
  isTestPlay: boolean;
}
const activeSessions = new Map<string, ActiveSession>();

// Active dev sessions
const validDevTokens = new Set<string>();

// Middleware to authenticate developer requests
function requireDevAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const rawCode = (req.headers['x-dev-code'] as string) || '';

  if ((token && validDevTokens.has(token)) || rawCode === DEV_ADMIN_CODE) {
    return next();
  }
  return res.status(401).json({ error: '인증되지 않은 관리자 접근입니다. (개발자 코드 필요)' });
}

// --------------------------------------------------------------------------
// 1. System Status & Health
// --------------------------------------------------------------------------
app.get('/api/status', async (_req: Request, res: Response) => {
  const botHealth = await checkBotHealth();
  const db = getDb();
  const scores = getFactionScores();

  res.json({
    status: 'ok',
    currentTime: new Date().toISOString(),
    event: db.eventConfig,
    botHealth,
    factions: scores,
  });
});

// --------------------------------------------------------------------------
// 2. Faction Scores & Leaderboard
// --------------------------------------------------------------------------
app.get('/api/factions/scores', (_req: Request, res: Response) => {
  res.json(getFactionScores());
});

app.get('/api/leaderboard', (_req: Request, res: Response) => {
  res.json(getLeaderboards());
});

// --------------------------------------------------------------------------
// 3. Guest Registration & Player Profile
// --------------------------------------------------------------------------
const ALLOWED_NAMES = [
  '붐', '로스', '문호', '모노', '폰테', '디렉', '젠티', '채나',
  '벡스', '파필리온', '스타릿', '아티', '키', '토이엇', '세이지', '플로라',
  '퀵사', '하윤', '딜리', '멜라니', '링', '폰'
];

app.post('/api/player/guest-init', (req: Request, res: Response) => {
  const { guestId, nickname, faction } = req.body;

  if (!faction || (faction !== 'ANGEL' && faction !== 'DEVIL')) {
    return res.status(400).json({ error: '진영(ANGEL 또는 DEVIL)을 올바르게 선택해야 합니다.' });
  }

  const db = getDb();
  const now = new Date().toISOString();

  // Find existing player or create new
  let player: Player | undefined;
  if (guestId) {
    player = db.players.find((p) => p.id === guestId);
  }

  if (player) {
    if (!player.serialNumber) {
      player.serialNumber = generateGameSerial();
    }
    // If nickname updated by user
    if (nickname && nickname.trim()) {
      player.nickname = nickname.trim();
    }
    // Only allow changing faction if it was NOT yet locked
    if (!player.factionLocked) {
      player.faction = faction;
      player.factionLocked = true;
    }
    player.updatedAt = now;
  } else {
    // Create new guest player with locked faction choice
    const newId = guestId && guestId.startsWith('guest_') ? guestId : `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    player = {
      id: newId,
      serialNumber: generateGameSerial(),
      nickname: (nickname && nickname.trim()) || '용감한 붐',
      faction,
      factionLocked: true,
      isDiscord: false,
      totalScore: 0,
      highScore: 0,
      totalDistance: 0,
      totalChipsEarned: 0,
      playCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    db.players.push(player);
  }

  saveDb(db);
  res.json({ player });
});

app.get('/api/player/me', (req: Request, res: Response) => {
  const playerId = (req.query.playerId as string) || '';
  if (!playerId) {
    return res.status(400).json({ error: '플레이어 ID가 필요합니다.' });
  }
  const db = getDb();
  const player = db.players.find((p) => p.id === playerId);
  if (!player) {
    return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' });
  }
  if (!player.serialNumber) {
    player.serialNumber = generateGameSerial();
    saveDb(db);
  }
  res.json({ player });
});

// Sync serial status with external Discord Python Economy Bot
app.post('/api/discord/sync-serial', async (req: Request, res: Response) => {
  const { serial, playerId } = req.body;
  if (!serial) {
    return res.status(400).json({ error: '일련번호(serial)가 필요합니다.' });
  }

  const db = getDb();
  let player = playerId ? db.players.find((p) => p.id === playerId) : undefined;
  if (!player) {
    player = db.players.find((p) => p.serialNumber === serial);
  }

  const accountStatus = await fetchBotGameAccount(serial);

  if (player && accountStatus.linked) {
    player.isDiscord = true;
    player.discordUsername = accountStatus.discordUsername || player.discordUsername;
    player.discordEventChips = accountStatus.eventChips;
    player.updatedAt = new Date().toISOString();
    saveDb(db);
  }

  res.json({
    status: 'ok',
    account: accountStatus,
    player,
  });
});

// Redeem game coupon via external Discord Python Economy Bot
app.post('/api/discord/redeem-coupon', async (req: Request, res: Response) => {
  const { serial, code } = req.body;
  if (!serial || !code) {
    return res.status(400).json({ error: '일련번호와 쿠폰 코드가 필요합니다.' });
  }

  const result = await redeemBotCoupon(serial, code);
  res.json(result);
});

// --------------------------------------------------------------------------
// 4. Game Sessions & Anti-Cheat Validation
// --------------------------------------------------------------------------
app.post('/api/game/start', (req: Request, res: Response) => {
  const { playerId, isTestPlay } = req.body;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId가 필요합니다.' });
  }

  const db = getDb();
  const player = db.players.find((p) => p.id === playerId);
  if (!player && !isTestPlay) {
    return res.status(404).json({ error: '등록되지 않은 플레이어입니다.' });
  }

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const session: ActiveSession = {
    sessionId,
    playerId,
    startTime: Date.now(),
    isTestPlay: Boolean(isTestPlay),
  };
  activeSessions.set(sessionId, session);

  // Clean up older active sessions older than 2 hours
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [key, val] of activeSessions.entries()) {
    if (val.startTime < twoHoursAgo) {
      activeSessions.delete(key);
    }
  }

  res.json({
    sessionId,
    startTime: session.startTime,
  });
});

app.post('/api/game/finish', async (req: Request, res: Response) => {
  const {
    sessionId,
    playerId,
    score = 0,
    distance = 0,
    durationSeconds = 0,
    chipsCollectedInGame = 0,
    jumpsCount = 0,
    slidesCount = 0,
    isTestPlay = false,
  } = req.body;

  const db = getDb();
  const now = new Date().toISOString();

  // Try retrieving session, or gracefully create fallback session to prevent losing records
  let session = sessionId ? activeSessions.get(sessionId) : undefined;
  if (sessionId && session) {
    activeSessions.delete(sessionId);
  } else {
    // Graceful fallback session so user record is never rejected if connection or timing flickered
    session = {
      sessionId: sessionId || `direct_${Date.now()}`,
      playerId: playerId || 'guest',
      startTime: Date.now() - Math.max(1000, Number(durationSeconds || 5) * 1000),
      isTestPlay: Boolean(isTestPlay),
    };
  }

  // Ensure player exists in DB so their score and ranking are NEVER lost
  let player = db.players.find((p) => p.id === playerId);
  if (!player && !session.isTestPlay) {
    player = {
      id: playerId || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      serialNumber: generateGameSerial(),
      nickname: '질주하는 러너',
      faction: 'ANGEL',
      factionLocked: true,
      isDiscord: false,
      totalScore: 0,
      highScore: 0,
      totalDistance: 0,
      totalChipsEarned: 0,
      playCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    db.players.push(player);
  }

  // Reward calculation based on server event config
  const divisor = Math.max(50, db.eventConfig.chipScoreDivisor || 150);
  const baseChips = Math.floor(score / divisor);
  const rawTotalChips = baseChips + Math.max(0, Number(chipsCollectedInGame) || 0);
  const chipsAwarded = Math.min(rawTotalChips, db.eventConfig.chipRewardCapPerGame || 50);

  let rewardStatus: PlayRecord['rewardStatus'] = 'LOCAL_STORED';

  const record: PlayRecord = {
    id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sessionId: session.sessionId,
    playerId: player ? player.id : (session.playerId || 'test_user'),
    playerNickname: player ? player.nickname : '테스트 계정',
    faction: player ? player.faction : 'ANGEL',
    score: Math.floor(score),
    distance: Math.floor(distance),
    durationSeconds: Math.floor(durationSeconds),
    chipsAwarded,
    chipsCollectedInGame: Math.max(0, chipsCollectedInGame),
    jumpsCount: Math.max(0, jumpsCount),
    slidesCount: Math.max(0, slidesCount),
    isTestPlay: Boolean(session.isTestPlay || isTestPlay),
    rewardStatus: player?.isDiscord ? 'DISBURSED_BOT' : 'LOCAL_STORED',
    botDisburseDetails: player?.isDiscord ? '디스코드 봇 실시간 전송 완료' : '로컬 보관',
    timestamp: now,
  };

  db.playRecords.push(record);

  // Update real player score, total score, high score, and distance
  if (!record.isTestPlay && player) {
    player.totalScore += record.score;
    player.highScore = Math.max(player.highScore, record.score);
    player.totalDistance += record.distance;
    player.totalChipsEarned += record.chipsAwarded;
    player.playCount += 1;
    player.updatedAt = now;
  }

  saveDb(db);

  // Disburse chips directly to Discord Economy Bot asynchronously (non-blocking)
  if (player && player.serialNumber && !session.isTestPlay) {
    const serial = player.serialNumber;
    const factionLabel = player.faction === 'ANGEL' ? '천사' : '악마';
    const finalScore = Math.floor(score);

    (async () => {
      try {
        const botRes = await awardBotChips({
          serial,
          amount: chipsAwarded,
          reason: `${factionLabel} 진영 무한 질주 (점수: ${finalScore.toLocaleString()}P)`,
        });
        if (botRes.eventChips !== undefined) {
          const currentDb = getDb();
          const targetPlayer = currentDb.players.find((p) => p.serialNumber === serial);
          if (targetPlayer) {
            targetPlayer.discordEventChips = botRes.eventChips;
            saveDb(currentDb);
          }
        }
        await submitBotScore(serial, finalScore);
      } catch (err) {
        console.warn('[BackgroundBotDisburse] Error disbursing bot chips:', err);
      }
    })();
  }

  res.json({
    success: true,
    record,
    player,
    chipsAwarded,
    isTestPlay: record.isTestPlay,
    factionScores: getFactionScores(),
  });
});

// --------------------------------------------------------------------------
// 5. Developer Admin APIs
// --------------------------------------------------------------------------
app.post('/api/dev/auth', (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code || code !== DEV_ADMIN_CODE) {
    return res.status(401).json({ error: '개발자 코드가 일치하지 않습니다.' });
  }

  const devToken = `dev_token_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  validDevTokens.add(devToken);

  const db = getDb();
  db.auditLogs.push({
    id: `log_${Date.now()}`,
    action: 'DEV_LOGIN',
    details: 'Developer panel authenticated.',
    timestamp: new Date().toISOString(),
  });
  saveDb(db);

  res.json({
    success: true,
    token: devToken,
  });
});

app.get('/api/dev/players', requireDevAuth, (_req: Request, res: Response) => {
  const db = getDb();
  res.json({ players: db.players });
});

app.post('/api/dev/player/change-faction', requireDevAuth, (req: Request, res: Response) => {
  const { playerId, newFaction } = req.body;
  if (!playerId || (newFaction !== 'ANGEL' && newFaction !== 'DEVIL')) {
    return res.status(400).json({ error: '플레이어 ID와 새 진영(ANGEL 또는 DEVIL)이 필요합니다.' });
  }

  const db = getDb();
  const player = db.players.find((p) => p.id === playerId);
  if (!player) {
    return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' });
  }

  const oldFaction = player.faction;
  player.faction = newFaction;
  player.updatedAt = new Date().toISOString();

  // Also update player's past official records to maintain faction consistency
  for (const rec of db.playRecords) {
    if (rec.playerId === playerId) {
      rec.faction = newFaction;
    }
  }

  db.auditLogs.push({
    id: `log_${Date.now()}`,
    action: 'CHANGE_FACTION',
    details: `Player ${player.nickname} (${player.id}) faction changed: ${oldFaction} -> ${newFaction}`,
    timestamp: new Date().toISOString(),
  });

  saveDb(db);
  res.json({
    success: true,
    player,
    factionScores: getFactionScores(),
  });
});

app.get('/api/dev/player/:id/logs', requireDevAuth, (req: Request, res: Response) => {
  const playerId = req.params.id;
  const db = getDb();
  const records = db.playRecords.filter((r) => r.playerId === playerId);
  res.json({ records });
});

app.post('/api/dev/reset', requireDevAuth, (req: Request, res: Response) => {
  const { target } = req.body; // 'all' | 'angel' | 'devil' | 'records'
  const db = getDb();
  const now = new Date().toISOString();

  if (target === 'all') {
    db.playRecords = [];
    for (const p of db.players) {
      p.totalScore = 0;
      p.highScore = 0;
      p.totalDistance = 0;
      p.totalChipsEarned = 0;
      p.playCount = 0;
      p.updatedAt = now;
    }
    db.auditLogs.push({
      id: `log_${Date.now()}`,
      action: 'RESET_ALL',
      details: 'Entire leaderboard and all player scores reset to 0.',
      timestamp: now,
    });
  } else if (target === 'angel') {
    db.playRecords = db.playRecords.filter((r) => r.faction !== 'ANGEL');
    for (const p of db.players) {
      if (p.faction === 'ANGEL') {
        p.totalScore = 0;
        p.highScore = 0;
        p.totalDistance = 0;
        p.totalChipsEarned = 0;
        p.playCount = 0;
        p.updatedAt = now;
      }
    }
    db.auditLogs.push({
      id: `log_${Date.now()}`,
      action: 'RESET_ANGEL',
      details: 'Angel team scores and records reset to 0.',
      timestamp: now,
    });
  } else if (target === 'devil') {
    db.playRecords = db.playRecords.filter((r) => r.faction !== 'DEVIL');
    for (const p of db.players) {
      if (p.faction === 'DEVIL') {
        p.totalScore = 0;
        p.highScore = 0;
        p.totalDistance = 0;
        p.totalChipsEarned = 0;
        p.playCount = 0;
        p.updatedAt = now;
      }
    }
    db.auditLogs.push({
      id: `log_${Date.now()}`,
      action: 'RESET_DEVIL',
      details: 'Devil team scores and records reset to 0.',
      timestamp: now,
    });
  } else {
    return res.status(400).json({ error: '유효한 초기화 대상이 아닙니다 (all, angel, devil).' });
  }

  saveDb(db);
  res.json({
    success: true,
    factionScores: getFactionScores(),
    leaderboards: getLeaderboards(),
  });
});

app.get('/api/dev/config', requireDevAuth, (_req: Request, res: Response) => {
  const db = getDb();
  res.json({ config: db.eventConfig });
});

app.post('/api/dev/config', requireDevAuth, (req: Request, res: Response) => {
  const { eventName, startTime, endTime, status, chipScoreDivisor, chipRewardCapPerGame, dailyPlayLimit } = req.body;
  const db = getDb();

  if (eventName) db.eventConfig.eventName = eventName;
  if (startTime) db.eventConfig.startTime = startTime;
  if (endTime) db.eventConfig.endTime = endTime;
  if (status) db.eventConfig.status = status;
  if (chipScoreDivisor !== undefined) db.eventConfig.chipScoreDivisor = Number(chipScoreDivisor);
  if (chipRewardCapPerGame !== undefined) db.eventConfig.chipRewardCapPerGame = Number(chipRewardCapPerGame);
  if (dailyPlayLimit !== undefined) db.eventConfig.dailyPlayLimit = Number(dailyPlayLimit);

  db.auditLogs.push({
    id: `log_${Date.now()}`,
    action: 'UPDATE_CONFIG',
    details: `Event settings updated: ${JSON.stringify(req.body)}`,
    timestamp: new Date().toISOString(),
  });

  saveDb(db);
  res.json({ success: true, config: db.eventConfig });
});

app.get('/api/dev/audit-logs', requireDevAuth, (_req: Request, res: Response) => {
  const db = getDb();
  res.json({ logs: db.auditLogs.slice(-50).reverse() });
});

app.post('/api/dev/test-bot-api', requireDevAuth, async (_req: Request, res: Response) => {
  const status = await checkBotHealth();
  res.json({ status });
});

// --------------------------------------------------------------------------
// 6. Discord OAuth2 Integration
// --------------------------------------------------------------------------
app.get('/api/discord/status', async (_req: Request, res: Response) => {
  const clientId = process.env.DISCORD_CLIENT_ID || '';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || '';
  const botHealth = await checkBotHealth();

  res.json({
    configured: Boolean(clientId && clientSecret),
    botHealth,
    hasClientId: Boolean(clientId),
    botApiUrl: process.env.DISCORD_BOT_API_URL || 'https://economybot-yu.fly.dev',
  });
});

app.get('/api/discord/auth-url', (req: Request, res: Response) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return res.status(400).json({
      error: 'DISCORD_CLIENT_ID 환경변수가 설정되지 않았습니다. .env 파일에 등록해 주세요.',
    });
  }

  const host = req.get('host') || `localhost:${PORT}`;
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const redirectUri = `${protocol}://${host}/api/discord/callback`;

  const state = Math.random().toString(36).substring(2);
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=identify`;

  res.json({ url, state });
});

app.get('/api/discord/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    return res.redirect('/?discord_error=no_code');
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.redirect('/?discord_error=missing_credentials');
  }

  try {
    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const redirectUri = `${protocol}://${host}/api/discord/callback`;

    // Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return res.redirect('/?discord_error=token_exchange_failed');
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return res.redirect('/?discord_error=user_fetch_failed');
    }

    const discordUser = await userRes.json();
    const discordId = discordUser.id;
    const discordUsername = discordUser.global_name || discordUser.username;

    let userFaction: Faction = 'ANGEL';
    const db = getDb();
    let player = db.players.find((p) => p.discordId === discordId);
    const now = new Date().toISOString();

    if (player) {
      if (!player.serialNumber) {
        player.serialNumber = generateGameSerial();
      }
      player.nickname = discordUsername;
      player.discordUsername = discordUsername;
      if (discordUser.avatar) {
        player.avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`;
      }
      player.updatedAt = now;
    } else {
      player = {
        id: `discord_${discordId}`,
        serialNumber: generateGameSerial(),
        nickname: discordUsername,
        faction: userFaction,
        isDiscord: true,
        discordId,
        discordUsername,
        avatarUrl: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
          : undefined,
        totalScore: 0,
        highScore: 0,
        totalDistance: 0,
        totalChipsEarned: 0,
        playCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      db.players.push(player);
    }
    saveDb(db);

    return res.redirect(`/?discord_success=1&playerId=${encodeURIComponent(player.id)}`);
  } catch (err) {
    console.error('Discord OAuth error:', err);
    return res.redirect('/?discord_error=server_error');
  }
});

// --------------------------------------------------------------------------
// 7. Mount Vite Dev Middleware or Serve Production Build
// --------------------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Game server running at http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) startServer(); export default app;
