export interface TTLProvider {
  touch(resource: string, ttlMs: number): Promise<void>;
  isExpired(resource: string): Promise<boolean>;
  remove?(resource: string): Promise<void>;
}
