import { spawn } from "node:child_process";

export const SANDOCK_CLI_CLIENT_ID = "sandock-cli";

const DEFAULT_DEVICE_CODE_TTL_SECONDS = 15 * 60;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const SLOW_DOWN_INCREMENT_SECONDS = 5;
const MAX_CONSECUTIVE_NETWORK_FAILURES = 3;

interface DeviceCodeResponse {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  expires_in?: number;
  interval?: number;
}

interface DeviceTokenResponse {
  access_token?: string;
  error?: string;
}

interface FinalizedApiKey {
  apiKey: string;
  apiKeyId: string;
  expiresAt: string | null;
  credentialType: "api_key";
}

interface SuccessEnvelope<T> {
  success?: boolean;
  data?: T;
}

export interface DeviceLoginOptions {
  apiUrl: string;
  existingApiKey: boolean;
  useBrowser: boolean;
}

export interface DeviceLoginDependencies {
  confirmReplacement: () => Promise<boolean>;
  fetch: typeof fetch;
  now: () => number;
  onStatus: (message: string) => void;
  openBrowser: (url: string) => void;
  saveApiKey: (apiKey: string) => void | Promise<void>;
  sleep: (durationMs: number) => Promise<void>;
}

export type DeviceLoginResult =
  | { status: "cancelled" }
  | {
      status: "signed_in";
      apiKeyId: string;
      expiresAt: string | null;
    };

function normalizeApiUrl(apiUrl: string): string {
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new Error(`Invalid Sandock API URL: ${apiUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Sandock API URL must use http or https.");
  }
  return url.href.replace(/\/$/, "");
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

async function requestDeviceCode(
  apiUrl: string,
  fetchFn: typeof fetch,
): Promise<{
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUrl: string;
  expiresInSeconds: number;
  intervalSeconds: number;
}> {
  let response: Response;
  try {
    response = await fetchFn(`${apiUrl}/api/auth/device/code`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: new URL(apiUrl).origin,
      },
      body: JSON.stringify({
        client_id: SANDOCK_CLI_CLIENT_ID,
        scope: "openid profile email",
      }),
    });
  } catch {
    throw new Error(`Could not start device sign-in because ${apiUrl} could not be reached.`);
  }

  const payload = await readJson<DeviceCodeResponse>(response);
  if (!response.ok) {
    throw new Error(`Could not start device sign-in (HTTP ${response.status}).`);
  }
  if (!payload.device_code || !payload.user_code || !payload.verification_uri) {
    throw new Error("Device sign-in returned an incomplete authorization response.");
  }

  return {
    deviceCode: payload.device_code,
    userCode: payload.user_code,
    verificationUri: payload.verification_uri,
    verificationUrl: payload.verification_uri_complete ?? payload.verification_uri,
    expiresInSeconds: Math.max(1, payload.expires_in ?? DEFAULT_DEVICE_CODE_TTL_SECONDS),
    intervalSeconds: Math.max(1, payload.interval ?? DEFAULT_POLL_INTERVAL_SECONDS),
  };
}

async function finalizeApiKey(
  apiUrl: string,
  deviceCode: string,
  accessToken: string,
  fetchFn: typeof fetch,
): Promise<FinalizedApiKey> {
  let response: Response;
  try {
    response = await fetchFn(`${apiUrl}/api/v1/device/finalize`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ deviceCode }),
    });
  } catch {
    throw new Error("Device sign-in could not finalize the API key because the network failed.");
  }

  const envelope = await readJson<SuccessEnvelope<FinalizedApiKey>>(response);
  const finalized = envelope.data;
  if (
    !response.ok ||
    envelope.success === false ||
    !finalized?.apiKey ||
    !finalized.apiKeyId ||
    finalized.credentialType !== "api_key"
  ) {
    throw new Error(`Device sign-in could not finalize the API key (HTTP ${response.status}).`);
  }
  return finalized;
}

async function pollForApiKey(
  apiUrl: string,
  authorization: Awaited<ReturnType<typeof requestDeviceCode>>,
  dependencies: DeviceLoginDependencies,
): Promise<FinalizedApiKey> {
  const deadline = dependencies.now() + authorization.expiresInSeconds * 1000;
  let intervalSeconds = authorization.intervalSeconds;
  let consecutiveNetworkFailures = 0;

  while (dependencies.now() < deadline) {
    await dependencies.sleep(intervalSeconds * 1000);

    let response: Response;
    try {
      response = await dependencies.fetch(`${apiUrl}/api/auth/device/token`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: new URL(apiUrl).origin,
        },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: authorization.deviceCode,
          client_id: SANDOCK_CLI_CLIENT_ID,
        }),
      });
      consecutiveNetworkFailures = 0;
    } catch {
      consecutiveNetworkFailures += 1;
      if (consecutiveNetworkFailures >= MAX_CONSECUTIVE_NETWORK_FAILURES) {
        throw new Error(
          "Device sign-in lost its network connection. Check connectivity and run `sandock login` again.",
        );
      }
      continue;
    }

    const payload = await readJson<DeviceTokenResponse>(response);
    if (response.ok && payload.access_token) {
      return finalizeApiKey(
        apiUrl,
        authorization.deviceCode,
        payload.access_token,
        dependencies.fetch,
      );
    }

    switch (payload.error) {
      case "authorization_pending":
        continue;
      case "slow_down":
        intervalSeconds += SLOW_DOWN_INCREMENT_SECONDS;
        continue;
      case "access_denied":
      case "authorization_declined":
        throw new Error("Device sign-in was denied. No API key was saved.");
      case "expired_token":
        throw new Error("The device code expired. Run `sandock login` to request a new one.");
      default:
        throw new Error(`Device sign-in failed (HTTP ${response.status}).`);
    }
  }

  throw new Error("The device code expired. Run `sandock login` to request a new one.");
}

export async function performDeviceLogin(
  options: DeviceLoginOptions,
  dependencies: DeviceLoginDependencies,
): Promise<DeviceLoginResult> {
  if (options.existingApiKey && !(await dependencies.confirmReplacement())) {
    return { status: "cancelled" };
  }

  const apiUrl = normalizeApiUrl(options.apiUrl);
  const authorization = await requestDeviceCode(apiUrl, dependencies.fetch);

  dependencies.onStatus("");
  dependencies.onStatus("Authorize Sandock CLI in your browser:");
  dependencies.onStatus(`  ${authorization.verificationUri}`);
  dependencies.onStatus(`  Code: ${authorization.userCode}`);
  dependencies.onStatus("");
  if (options.useBrowser) {
    dependencies.openBrowser(authorization.verificationUrl);
  }
  dependencies.onStatus("Waiting for authorization...");

  const finalized = await pollForApiKey(apiUrl, authorization, dependencies);
  await dependencies.saveApiKey(finalized.apiKey);

  return {
    status: "signed_in",
    apiKeyId: finalized.apiKeyId,
    expiresAt: finalized.expiresAt,
  };
}

export function openBrowser(url: string, onFailure: () => void): void {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];

  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", onFailure);
    child.unref();
  } catch {
    onFailure();
  }
}

export const defaultDeviceLoginDependencies = (): Pick<
  DeviceLoginDependencies,
  "fetch" | "now" | "sleep"
> => ({
  fetch: globalThis.fetch,
  now: Date.now,
  sleep: (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
});
