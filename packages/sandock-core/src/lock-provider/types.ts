export interface LockProvider {
  acquire(resource: string): Promise<string>; // returns lock token
  release(resource: string, token: string): Promise<void>;
}

export type LockProviderKind = "redis" | "file";
