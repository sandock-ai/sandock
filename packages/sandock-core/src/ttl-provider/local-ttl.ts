import type { TTLProvider } from "./types";

interface Entry {
  last: number;
  ttl: number;
}

export class LocalTTLProvider implements TTLProvider {
  private map = new Map<string, Entry>();
  async touch(resource: string, ttlMs: number): Promise<void> {
    this.map.set(resource, { last: Date.now(), ttl: ttlMs });
  }
  async isExpired(resource: string): Promise<boolean> {
    const e = this.map.get(resource);
    if (!e) return true;
    return Date.now() - e.last > e.ttl;
  }
  async remove(resource: string): Promise<void> {
    this.map.delete(resource);
  }
}
