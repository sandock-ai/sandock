/**
 * PTY Session Manager
 * Tracks active PTY sessions in memory with idle timeout cleanup.
 */

import type { PtySession } from "./types";

interface ManagedPtySession {
  session: PtySession;
  sandboxId: string;
  createdAt: number;
  lastActivityAt: number;
}

class PtySessionManager {
  private sessions = new Map<string, ManagedPtySession>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private idleTimeoutMs = 30 * 60 * 1000) {
    // Sweep idle sessions every 60s
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    this.cleanupInterval.unref();
  }

  add(sandboxId: string, session: PtySession): void {
    const now = Date.now();
    this.sessions.set(session.id, {
      session,
      sandboxId,
      createdAt: now,
      lastActivityAt: now,
    });
  }

  get(sessionId: string): ManagedPtySession | undefined {
    return this.sessions.get(sessionId);
  }

  listBySandbox(sandboxId: string): ManagedPtySession[] {
    const result: ManagedPtySession[] = [];
    for (const entry of this.sessions.values()) {
      if (entry.sandboxId === sandboxId) result.push(entry);
    }
    return result;
  }

  /** Update last activity timestamp (call on every keystroke) */
  touch(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) entry.lastActivityAt = Date.now();
  }

  async kill(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;
    try {
      await entry.session.kill();
    } catch {
      // ignore
    }
    this.sessions.delete(sessionId);
  }

  get activeCount(): number {
    return this.sessions.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (now - entry.lastActivityAt > this.idleTimeoutMs) {
        entry.session.kill().catch(() => {});
        this.sessions.delete(id);
        console.log(`[PTY] Session ${id} idle-expired (sandbox: ${entry.sandboxId})`);
      }
    }
  }

  dispose(): void {
    clearInterval(this.cleanupInterval);
    for (const [id, entry] of this.sessions) {
      entry.session.kill().catch(() => {});
      this.sessions.delete(id);
    }
  }
}

export const ptySessionManager = new PtySessionManager();
