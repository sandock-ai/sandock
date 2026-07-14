import Docker from "dockerode";

/**
 * Detect whether the local Docker daemon is available for test skip logic, with logging.
 * Return true when available; false means unavailable and tests should skip.
 */
let _docker: Docker | undefined;

/** Get and cache the shared Docker client instance used by tests */
export function getDocker(): Docker {
  if (!_docker) _docker = new Docker();
  return _docker;
}

export async function canConnectDocker(): Promise<boolean> {
  try {
    await getDocker().ping();
    console.log("[sandbox:test] Docker available (daemon reachable)");
    return true;
  } catch (e) {
    console.warn(
      "[sandbox:test] Docker unavailable; skipping related tests:",
      (e as Error).message,
    );
    return false;
  }
}
