/**
 * Multi-cluster config from environment variable.
 *
 * CLUSTER_CONFIGS env format (JSON):
 * {
 *   "prod-east": { "kubeconfigBase64": "base64..." },
 *   "prod-west": { "kubeconfigBase64": "base64...", "hostIp": "10.0.1.1" }
 * }
 *
 * When not set, Sandock uses the default in-cluster / KUBECONFIG config.
 */

interface ClusterEntry {
  kubeconfigBase64: string;
  hostIp?: string;
}

let parsed: Record<string, ClusterEntry> | null = null;

const getConfigs = (): Record<string, ClusterEntry> => {
  if (parsed) return parsed;
  const raw = process.env.CLUSTER_CONFIGS;
  if (!raw) {
    parsed = {};
    return parsed;
  }
  try {
    parsed = JSON.parse(raw) as Record<string, ClusterEntry>;
  } catch (e) {
    throw new Error(`CLUSTER_CONFIGS env is not valid JSON: ${(e as Error).message}`);
  }
  return parsed;
};

export const resolveClusterKubeconfig = (clusterId: string): string | undefined =>
  getConfigs()[clusterId]?.kubeconfigBase64;

export const listClusters = (): { id: string; hostIp?: string }[] =>
  Object.entries(getConfigs()).map(([id, v]) => ({ id, hostIp: v.hostIp }));
