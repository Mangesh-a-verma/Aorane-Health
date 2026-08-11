/**
 * Shared cache/store — OTPs, rate-limit counters, session-logout markers,
 * short-lived response caches, webhook-idempotency markers.
 *
 * PRODUCTION-HARDENING PASS (Phase 1.1 — shared store):
 * Previously this was a plain in-process `Map`, despite the filename
 * suggesting Redis. On Render that means every piece of state here lived
 * ONLY in that one server process's memory:
 *   - Any deploy, crash, or (on the free plan) hibernate/wake cycle wiped
 *     every pending OTP, rate-limit counter, and logout marker instantly.
 *   - If the app is ever scaled to more than one instance, a user's OTP
 *     send could land on instance A and their verify request on instance
 *     B — which never saw the OTP — causing a random, unreproducible
 *     "invalid OTP" failure.
 *
 * Now: if REDIS_URL is set, everything here is backed by real Redis
 * (works with Upstash's free tier or any standard Redis/TLS endpoint) —
 * shared across every instance and durable across restarts. If REDIS_URL
 * is NOT set, this transparently falls back to the original in-memory Map
 * so local dev / a not-yet-configured environment keeps working exactly
 * as before (with the same limitations as before — this is a fallback,
 * not a fix, for that case).
 *
 * All `cache.*` methods are async (return Promises) regardless of which
 * backend is active, so call sites are backend-agnostic and must `await`.
 */

import Redis from "ioredis";
import { logger } from "./logger";

const OTP_EXPIRY_SECONDS = 900;

// ─── Atomic "increment, set TTL only on first hit" — classic fixed-window
// rate limiter. Must be atomic (Lua script) so two concurrent requests for
// the same key can't both read count=0 and both think they're "first".
const INCR_FIXED_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  incrementFixedWindow(key: string, ttlSeconds: number): Promise<number>;
}

// ─── Redis-backed implementation ───────────────────────────────────────────
class RedisBackend implements CacheBackend {
  private client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 2,
      // Exponential backoff, capped — avoids hammering Redis (or Upstash's
      // connection limits) if it's briefly unreachable, while still
      // recovering automatically once it's back.
      retryStrategy: (times) => Math.min(times * 200, 3000),
      lazyConnect: false,
    });

    this.client.on("error", (err) => {
      logger.error({ err }, "[redis] connection error");
    });
    this.client.on("connect", () => {
      logger.info("[redis] connected");
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, "EX", ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incrementFixedWindow(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.client.eval(INCR_FIXED_WINDOW_SCRIPT, 1, key, ttlSeconds);
    return Number(result);
  }
}

// ─── In-memory fallback (original behavior — used only when REDIS_URL is
// not configured, e.g. local dev without Redis set up yet) ────────────────
class InMemoryBackend implements CacheBackend {
  private store = new Map<string, { value: string; expiresAt: number }>();

  private prune(key: string): void {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.expiresAt) this.store.delete(key);
  }

  async get(key: string): Promise<string | null> {
    this.prune(key);
    const entry = this.store.get(key);
    return entry ? entry.value : null;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incrementFixedWindow(key: string, ttlSeconds: number): Promise<number> {
    this.prune(key);
    const existing = this.store.get(key);
    if (existing) {
      const next = parseInt(existing.value, 10) + 1;
      existing.value = String(next);
      return next;
    }
    this.store.set(key, { value: "1", expiresAt: Date.now() + ttlSeconds * 1000 });
    return 1;
  }
}

const redisUrl = process.env.REDIS_URL;
const backend: CacheBackend = redisUrl ? new RedisBackend(redisUrl) : new InMemoryBackend();

if (!redisUrl) {
  logger.warn(
    "[redis] REDIS_URL not set — falling back to in-memory store. " +
    "OTPs/rate-limits/sessions will NOT survive a restart and will NOT be " +
    "shared across multiple instances. Set REDIS_URL (e.g. Upstash free " +
    "tier) before scaling beyond a single instance.",
  );
}

export const cache = {
  async setOtp(identifier: string, hashedOtp: string): Promise<void> {
    await backend.set(`otp:${identifier}`, hashedOtp, OTP_EXPIRY_SECONDS);
  },
  async getOtp(identifier: string): Promise<string | null> {
    return backend.get(`otp:${identifier}`);
  },
  async deleteOtp(identifier: string): Promise<void> {
    await backend.delete(`otp:${identifier}`);
  },
  async setRateLimit(key: string, count: number, ttlSeconds: number): Promise<void> {
    await backend.set(`rate:${key}`, String(count), ttlSeconds);
  },
  async getRateLimit(key: string): Promise<number> {
    const val = await backend.get(`rate:${key}`);
    return val ? parseInt(val, 10) : 0;
  },
  // Resets a rate-limit counter (e.g. after a successful login) so the
  // next failed-attempt streak starts fresh instead of continuing to
  // count toward the existing window's limit.
  async resetRateLimit(key: string): Promise<void> {
    await backend.delete(`rate:${key}`);
  },
  // Only sets TTL on FIRST call — subsequent increments don't reset expiry.
  // Atomic on the Redis backend (Lua script); best-effort atomic (single
  // JS-thread) on the in-memory fallback.
  async incrementRateLimitFixed(key: string, ttlSeconds: number): Promise<number> {
    return backend.incrementFixedWindow(`rate:${key}`, ttlSeconds);
  },
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await backend.set(key, value, ttlSeconds);
  },
  async get(key: string): Promise<string | null> {
    return backend.get(key);
  },
  async delete(key: string): Promise<void> {
    await backend.delete(key);
  },
};
