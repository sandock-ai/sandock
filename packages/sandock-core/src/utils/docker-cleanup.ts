import { getDocker } from "./docker-available";

export interface DockerCleanupOptions {
  /** Exact container names to clean up */
  names?: string[];
  /** Match containers starting with one of these prefixes, unioned with names */
  prefixes?: string[];
  /** Whether to print matched but skipped containers for debugging */
  verbose?: boolean;
  /** Whether to delete containers; false only prints dry-run output */
  dryRun?: boolean;
}

export async function cleanupTestContainers(opts: DockerCleanupOptions = {}) {
  const docker = getDocker();
  const { names = [], prefixes = [], verbose = true, dryRun = false } = opts;
  if (names.length === 0 && prefixes.length === 0) {
    if (verbose) console.log("[sandbox:test] No names or prefixes provided; skipping cleanup");
    return { matched: 0, removed: 0 };
  }
  let list = [] as Awaited<ReturnType<ReturnType<typeof getDocker>["listContainers"]>>;
  try {
    list = await docker.listContainers({ all: true });
  } catch (e) {
    if (verbose) console.warn("[sandbox:test] Failed to list containers:", (e as Error).message);
    return { matched: 0, removed: 0 };
  }
  let matched = 0;
  let removed = 0;
  for (const c of list) {
    const containerNames: string[] = (c.Names || []).map((n) => n.replace(/^\//, ""));
    const hit = containerNames.find(
      (n) => names.includes(n) || prefixes.some((p) => n.startsWith(p)),
    );
    if (!hit) continue;
    matched++;
    if (dryRun) {
      if (verbose) console.log(`[sandbox:test] (dry) matched ${hit} id=${c.Id?.slice(0, 12)}`);
      continue;
    }
    try {
      const container = docker.getContainer(c.Id);
      try {
        await container.kill({ signal: "SIGKILL" });
      } catch {}
      await container.remove({ force: true });
      removed++;
      if (verbose)
        console.log(`[sandbox:test] Removed container name=${hit} id=${c.Id?.slice(0, 12)}`);
    } catch (e) {
      if (verbose)
        console.warn(
          `[sandbox:test] Failed to remove container name=${hit} id=${c.Id?.slice(0, 12)}:`,
          (e as Error).message,
        );
    }
  }
  if (verbose)
    console.log(
      `[sandbox:test] Cleanup summary matched=${matched} removed=${removed} (names=${names.join(",")}; prefixes=${prefixes.join(",")})`,
    );
  return { matched, removed };
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    const docker = getDocker();
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}
