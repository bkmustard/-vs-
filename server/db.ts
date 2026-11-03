import fs from 'fs';
import path from 'path';

export type Faction = 'ANGEL' | 'DEVIL';

export interface Player {
  id: string;
  serialNumber: string; // e.g. GS8-XXXXXXXX for Discord bot !게임연동
  nickname: string;
  faction: Faction;
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

export function generateGameSerial(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GS8-${code}`;
}

export interface PlayRecord {
  id: string;
  sessionId: string;
  playerId: string;
  playerNickname: string;
  faction: Faction;
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

export interface EventConfig {
  eventName: string;
  startTime: string;
  endTime: string;
  status: 'ACTIVE' | 'PAUSED' | 'ENDED';
  chipScoreDivisor: number; // e.g. 1,500 points = 1 chip
  chipRewardCapPerGame: number; // e.g. 5
  dailyPlayLimit: number; // 0 = unlimited
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface DatabaseSchema {
  players: Player[];
  playRecords: PlayRecord[];
  auditLogs: AuditLog[];
  eventConfig: EventConfig;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'kiban_stars.json');

// Default initial clean state (Strictly 0 players, 0 points, 0 fake records)
function getDefaultData(): DatabaseSchema {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    players: [],
    playRecords: [],
    auditLogs: [
      {
        id: 'init-1',
        action: 'SYSTEM_INIT',
        details: 'Initial clean database established. Zero mock players or records.',
        timestamp: now.toISOString(),
      },
    ],
    eventConfig: {
      eventName: '천사 VS 악마: 기반스타즈 S8',
      startTime: now.toISOString(),
      endTime: weekLater.toISOString(),
      status: 'ACTIVE',
      chipScoreDivisor: 1500,
      chipRewardCapPerGame: 5,
      dailyPlayLimit: 0,
    },
  };
}

let memoryDb: DatabaseSchema | null = null;
let saveLock = false;

export function getDb(): DatabaseSchema {
  if (memoryDb) {
    return memoryDb;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      memoryDb = JSON.parse(content);
      if (!memoryDb?.players || !memoryDb?.playRecords || !memoryDb?.eventConfig) {
        memoryDb = getDefaultData();
        saveDb(memoryDb);
      }
    } else {
      memoryDb = getDefaultData();
      saveDb(memoryDb);
    }
  } catch (err) {
    console.error('Error reading database file, using fallback memory state:', err);
    memoryDb = getDefaultData();
  }

  return memoryDb!;
}

export function saveDb(data: DatabaseSchema): void {
  memoryDb = data;
  if (saveLock) return;
  saveLock = true;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to write database file:', err);
  } finally {
    saveLock = false;
  }
}

export function getFactionScores() {
  const db = getDb();
  let angelScore = 0;
  let devilScore = 0;
  let angelPlayCount = 0;
  let devilPlayCount = 0;

  // Real official records only (no test plays)
  for (const rec of db.playRecords) {
    if (rec.isTestPlay) continue;
    if (rec.faction === 'ANGEL') {
      angelScore += rec.score;
      angelPlayCount++;
    } else if (rec.faction === 'DEVIL') {
      devilScore += rec.score;
      devilPlayCount++;
    }
  }

  const angelPlayers = db.players.filter((p) => p.faction === 'ANGEL').length;
  const devilPlayers = db.players.filter((p) => p.faction === 'DEVIL').length;

  let leadingFaction: 'ANGEL' | 'DEVIL' | 'TIE' = 'TIE';
  if (angelScore > devilScore) {
    leadingFaction = 'ANGEL';
  } else if (devilScore > angelScore) {
    leadingFaction = 'DEVIL';
  }

  return {
    angel: {
      totalScore: angelScore,
      playCount: angelPlayCount,
      playersCount: angelPlayers,
    },
    devil: {
      totalScore: devilScore,
      playCount: devilPlayCount,
      playersCount: devilPlayers,
    },
    leadingFaction,
    scoreDiff: Math.abs(angelScore - devilScore),
    totalPlayCount: angelPlayCount + devilPlayCount,
    totalPlayersCount: db.players.length,
    eventConfig: db.eventConfig,
  };
}

export function getLeaderboards() {
  const db = getDb();
  // Only players with actual play records count
  const activePlayers = db.players.filter((p) => p.playCount > 0);

  const sortByScore = (a: Player, b: Player) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return b.highScore - a.highScore;
  };

  const overall = [...activePlayers].sort(sortByScore);
  const angel = activePlayers.filter((p) => p.faction === 'ANGEL').sort(sortByScore);
  const devil = activePlayers.filter((p) => p.faction === 'DEVIL').sort(sortByScore);

  return {
    overall,
    angel,
    devil,
  };
}
