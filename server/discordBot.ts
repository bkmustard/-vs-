import dotenv from 'dotenv';
dotenv.config();

const BOT_API_URL = (process.env.DISCORD_BOT_API_URL || 'https://economybot-yu.fly.dev').replace(/\/+$/, '');

export interface BotHealthStatus {
  online: boolean;
  url: string;
  statusCode?: number;
  service?: string;
  message: string;
}

export interface BotAccountStatus {
  linked: boolean;
  eventChips: number;
  discordUsername?: string;
  personalBest?: number;
}

export async function checkBotHealth(): Promise<BotHealthStatus> {
  const url = `${BOT_API_URL}/health`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        online: true,
        url: BOT_API_URL,
        statusCode: res.status,
        service: data?.service || 'giban-stars-game-api',
        message: '경제 봇 서버 정상 연결 (HTTP 200)',
      };
    } else {
      return {
        online: false,
        url: BOT_API_URL,
        statusCode: res.status,
        message: `경제 봇 응답 오류 (HTTP ${res.status})`,
      };
    }
  } catch (err: any) {
    return {
      online: false,
      url: BOT_API_URL,
      message: `경제 봇 연결 실패: ${err.message || 'Network Timeout'}`,
    };
  }
}

/**
 * Check game account linkage status and fetch event_chips balance
 * Matches EconomyBot POST /api/game/account
 */
export async function fetchBotGameAccount(serial: string): Promise<BotAccountStatus> {
  const url = `${BOT_API_URL}/api/game/account`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ serial: serial.trim().toUpperCase() }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return {
        linked: Boolean(data.linked),
        eventChips: Number(data.eventChips || 0),
        discordUsername: data.discordUsername || undefined,
        personalBest: data.bestScore ? Number(data.bestScore) : undefined,
      };
    }
  } catch (err) {
    console.warn(`[DiscordBot] Failed to check account for ${serial}:`, err);
  }
  return { linked: false, eventChips: 0 };
}

/**
 * Award event chips to player's linked Discord bot balance
 * Matches EconomyBot POST /api/game/award-chips
 */
export async function awardBotChips(params: {
  serial: string;
  amount: number;
  reason: string;
}): Promise<{ success: boolean; eventChips?: number; status: 'DISBURSED_BOT' | 'BOT_FAILED' | 'BOT_SKIPPED_GUEST'; details: string }> {
  if (params.amount <= 0) {
    return { success: true, status: 'DISBURSED_BOT', details: 'Amount is 0' };
  }

  const url = `${BOT_API_URL}/api/game/award-chips`;
  const requestId = `gs8-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        serial: params.serial.trim().toUpperCase(),
        requestId,
        amount: Math.min(10000, Math.max(1, params.amount)),
        reason: params.reason || '천사 VS 악마 게임 보상',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        eventChips: data.eventChips,
        status: 'DISBURSED_BOT',
        details: `봇 잔액 적립 완료 (${data.eventChips}개 보유, DM 전송: ${data.dmSent})`,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error === 'not_linked') {
        return {
          success: false,
          status: 'BOT_SKIPPED_GUEST',
          details: '디스코드 미연동 계정 (게임 로컬에만 칩 보관됨)',
        };
      }
      return {
        success: false,
        status: 'BOT_FAILED',
        details: `Bot API error: HTTP ${res.status} ${errData.error || ''}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      status: 'BOT_FAILED',
      details: `Bot API call failed: ${err.message || 'Timeout'}`,
    };
  }
}

/**
 * Submit high score to Discord bot records
 * Matches EconomyBot POST /api/game/submit-score
 */
export async function submitBotScore(serial: string, score: number): Promise<{ success: boolean; personalBest?: number }> {
  const url = `${BOT_API_URL}/api/game/submit-score`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        serial: serial.trim().toUpperCase(),
        score: Math.max(0, Math.floor(score)),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: true, personalBest: data.personalBest };
    }
  } catch (err) {
    console.warn(`[DiscordBot] Submit score failed for ${serial}:`, err);
  }
  return { success: false };
}

/**
 * Redeem admin-issued game coupon
 * Matches EconomyBot POST /api/game/redeem-coupon
 */
export async function redeemBotCoupon(serial: string, code: string): Promise<{ success: boolean; lives?: number; error?: string }> {
  const url = `${BOT_API_URL}/api/game/redeem-coupon`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        serial: serial.trim().toUpperCase(),
        code: code.trim().toUpperCase(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true, lives: data.lives };
    } else {
      const messages: Record<string, string> = {
        not_linked: '먼저 디스코드에서 !게임연동을 진행해 주세요.',
        coupon_not_found: '존재하지 않거나 다른 유저에게 발급된 쿠폰입니다.',
        coupon_used: '이미 사용된 쿠폰입니다.',
      };
      return { success: false, error: messages[data.error] || `쿠폰 등록 실패 (${data.error || res.status})` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || '네트워크 오류' };
  }
}
