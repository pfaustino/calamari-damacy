/** Shared Vercel leaderboards service (see github.com/pfaustino/leaderboards). */

export const LEADERBOARD_GAME_ID = 'calamari-damacy';

/** Set at build time, or defaults to production API host. */
export const LEADERBOARD_API = (
  import.meta.env.VITE_LEADERBOARD_API || 'https://leaderboards-opal.vercel.app'
).replace(/\/$/, '');

/** Build-time write key (visible in client bundle — deters casual spam only). */
export const LEADERBOARD_WRITE_KEY = import.meta.env.VITE_LEADERBOARD_WRITE_KEY ?? '';

/** True when scores can be posted (needs write key in the Vite build). */
export function isGlobalLeaderboardConfigured() {
  return Boolean(LEADERBOARD_WRITE_KEY);
}

/** True when the public board can be fetched (API host is always defaulted). */
export function canFetchGlobalLeaderboard() {
  return Boolean(LEADERBOARD_API);
}

/**
 * @returns {Promise<{ ok: true, rows: Array<{ player: string, value: number, meta: object | null }> } | { ok: false, error: string }>}
 */
export async function fetchGlobalLeaderboard(limit = 50) {
  if (!LEADERBOARD_API) {
    return { ok: false, error: 'Global leaderboard URL not configured' };
  }
  try {
    const url = `${LEADERBOARD_API}/api/leaderboard?game=${LEADERBOARD_GAME_ID}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, error: `Server returned ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, rows: data.rows ?? [] };
  } catch {
    return { ok: false, error: 'Could not reach leaderboard server' };
  }
}

/**
 * @param {{ player: string, value: number, meta?: Record<string, unknown> }} payload
 */
export async function submitGlobalScore(payload) {
  if (!isGlobalLeaderboardConfigured()) return { ok: false, error: 'not configured' };
  try {
    const res = await fetch(`${LEADERBOARD_API}/api/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Game-Key': LEADERBOARD_WRITE_KEY,
      },
      body: JSON.stringify({
        game: LEADERBOARD_GAME_ID,
        player: payload.player,
        value: payload.value,
        meta: payload.meta,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'network error' };
  }
}

/**
 * Fire-and-forget global score submit after a stage ends (win or lose).
 * @param {{ leaderboardName?: string }} progress
 * @param {{
 *   sizeCm: number,
 *   count: number,
 *   stageId?: string,
 *   stageName?: string,
 *   mode?: string,
 *   collectCount?: number,
 *   multiplayer?: boolean,
 * }} run
 * @returns {{ ok: true, player: string } | { ok: false, reason: 'not_configured' | 'no_name' | 'bad_score' }}
 */
export function trySubmitGlobalClear(progress, run) {
  if (!isGlobalLeaderboardConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }
  const player = progress?.leaderboardName?.trim();
  if (!player) return { ok: false, reason: 'no_name' };
  const sizeCm = Number(run.sizeCm);
  if (!Number.isFinite(sizeCm) || sizeCm <= 0) {
    return { ok: false, reason: 'bad_score' };
  }
  submitGlobalScore({
    player,
    value: sizeCm,
    meta: {
      objects: run.count ?? 0,
      stage: run.stageName ?? '—',
      stageId: run.stageId ?? null,
      mode: run.mode ?? 'size',
      collectCount: run.collectCount ?? 0,
      multiplayer: Boolean(run.multiplayer),
    },
  });
  return { ok: true, player };
}
