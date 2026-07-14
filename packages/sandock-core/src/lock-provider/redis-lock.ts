import { randomUUID } from "node:crypto";
import type { RedisClientType } from "redis";
import type { LockProvider } from "./types";

export interface RedisLockProviderOptions {
  client: RedisClientType;
  lockTTLms?: number;
  acquireTimeoutMs?: number;
  retryDelayMs?: number;
  keyPrefix?: string;
}

export class RedisLockProvider implements LockProvider {
  private client: RedisClientType;
  private lockTTLms: number;
  private acquireTimeoutMs: number;
  private retryDelayMs: number;
  private keyPrefix: string;

  constructor(opts: RedisLockProviderOptions) {
    this.client = opts.client;
    this.lockTTLms = opts.lockTTLms ?? 5000;
    this.acquireTimeoutMs = opts.acquireTimeoutMs ?? 5000;
    this.retryDelayMs = opts.retryDelayMs ?? 120;
    this.keyPrefix = opts.keyPrefix ?? "sandbox";
  }

  private key(resource: string) {
    return `${this.keyPrefix}:lock:${resource}`;
  }

  async acquire(resource: string): Promise<string> {
    const token = randomUUID();
    const key = this.key(resource);
    const deadline = Date.now() + this.acquireTimeoutMs;
    while (Date.now() < deadline) {
      const ok = await this.client.set(key, token, { NX: true, PX: this.lockTTLms });
      if (ok) return token;
      await new Promise((r) => setTimeout(r, this.retryDelayMs));
    }
    throw new Error(`RedisLock acquire timeout: ${resource}`);
  }

  async release(resource: string, token: string): Promise<void> {
    const key = this.key(resource);
    const val = await this.client.get(key);
    if (val === token) await this.client.del(key);
  }
}
