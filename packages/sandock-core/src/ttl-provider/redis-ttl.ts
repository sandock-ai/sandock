import type { RedisClientType } from "redis";
import type { TTLProvider } from "./types";

export interface RedisTTLProviderOptions {
  client: RedisClientType;
  keyPrefix?: string;
}

export class RedisTTLProvider implements TTLProvider {
  private client: RedisClientType;
  private keyPrefix: string;
  constructor(opts: RedisTTLProviderOptions) {
    this.client = opts.client;
    this.keyPrefix = opts.keyPrefix ?? "sandbox";
  }
  private key(resource: string) {
    return `${this.keyPrefix}:meta:${resource}`;
  }
  async touch(resource: string, ttlMs: number): Promise<void> {
    const k = this.key(resource);
    // set if absent or just update pexpire
    const exists = await this.client.exists(k);
    if (exists) await this.client.pExpire(k, ttlMs);
    else await this.client.set(k, "1", { PX: ttlMs });
  }
  async isExpired(resource: string): Promise<boolean> {
    const k = this.key(resource);
    const ttl = await this.client.pTTL(k);
    if (ttl === -2) return true; // missing
    if (ttl === -1) return false; // no expire -> treat as not expired
    return ttl <= 0;
  }
  async remove(resource: string): Promise<void> {
    await this.client.del(this.key(resource));
  }
}
