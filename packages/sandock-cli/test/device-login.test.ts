import { afterEach, describe, expect, it, vi } from "vitest";
import { type DeviceLoginDependencies, performDeviceLogin } from "../src/lib/device-login.js";

const API_URL = "https://sandock.example";
const API_KEY = "test-api-key-placeholder";
const TEMPORARY_TOKEN = "temporary-session-token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createDependencies(
  fetchFn: typeof fetch,
  overrides: Partial<DeviceLoginDependencies> = {},
): DeviceLoginDependencies {
  return {
    confirmReplacement: vi.fn(async () => true),
    fetch: fetchFn,
    now: Date.now,
    onStatus: vi.fn(),
    openBrowser: vi.fn(),
    saveApiKey: vi.fn(),
    sleep: (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("performDeviceLogin", () => {
  it("polls pending authorization, finalizes the API key envelope, then saves it", async () => {
    vi.useFakeTimers();
    let polls = 0;
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.url.endsWith("/api/auth/device/code")) {
        expect(request.headers.get("origin")).toBe(API_URL);
        expect(await request.json()).toEqual({
          client_id: "sandock-cli",
          scope: "openid profile email",
        });
        return jsonResponse({
          device_code: "private-device-code",
          user_code: "ABCD-2345",
          verification_uri: `${API_URL}/device`,
          verification_uri_complete: `${API_URL}/device?user_code=ABCD-2345`,
          expires_in: 60,
          interval: 1,
        });
      }
      if (request.url.endsWith("/api/auth/device/token")) {
        polls += 1;
        expect(await request.json()).toEqual({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: "private-device-code",
          client_id: "sandock-cli",
        });
        return polls === 1
          ? jsonResponse({ error: "authorization_pending" }, 400)
          : jsonResponse({ access_token: TEMPORARY_TOKEN });
      }
      if (request.url.endsWith("/api/v1/device/finalize")) {
        expect(request.headers.get("authorization")).toBe(`Bearer ${TEMPORARY_TOKEN}`);
        expect(await request.json()).toEqual({ deviceCode: "private-device-code" });
        return jsonResponse({
          success: true,
          data: {
            apiKey: API_KEY,
            apiKeyId: "key_1",
            expiresAt: "2099-01-01T00:00:00.000Z",
            credentialType: "api_key",
          },
        });
      }
      throw new Error(`Unexpected request: ${request.url}`);
    }) as typeof fetch;
    const dependencies = createDependencies(fetchFn);

    const login = performDeviceLogin(
      { apiUrl: `${API_URL}/`, existingApiKey: false, useBrowser: true },
      dependencies,
    );
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(login).resolves.toEqual({
      status: "signed_in",
      apiKeyId: "key_1",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    expect(dependencies.openBrowser).toHaveBeenCalledWith(`${API_URL}/device?user_code=ABCD-2345`);
    expect(dependencies.saveApiKey).toHaveBeenCalledOnce();
    expect(dependencies.saveApiKey).toHaveBeenCalledWith(API_KEY);
    const terminalOutput = vi.mocked(dependencies.onStatus).mock.calls.flat().join("\n");
    expect(terminalOutput).toContain("ABCD-2345");
    expect(terminalOutput).not.toContain(API_KEY);
    expect(terminalOutput).not.toContain(TEMPORARY_TOKEN);
  });

  it("keeps the existing key when replacement confirmation is declined", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const dependencies = createDependencies(fetchFn, {
      confirmReplacement: vi.fn(async () => false),
    });

    await expect(
      performDeviceLogin(
        { apiUrl: API_URL, existingApiKey: true, useBrowser: false },
        dependencies,
      ),
    ).resolves.toEqual({ status: "cancelled" });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(dependencies.saveApiKey).not.toHaveBeenCalled();
  });

  it("honors slow_down and does not save after authorization is denied", async () => {
    vi.useFakeTimers();
    let polls = 0;
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/api/auth/device/code")) {
        return jsonResponse({
          device_code: "device-code",
          user_code: "CODE",
          verification_uri: `${API_URL}/device`,
          expires_in: 60,
          interval: 1,
        });
      }
      polls += 1;
      return polls === 1
        ? jsonResponse({ error: "slow_down" }, 400)
        : jsonResponse({ error: "access_denied" }, 400);
    }) as typeof fetch;
    const dependencies = createDependencies(fetchFn);

    const login = performDeviceLogin(
      { apiUrl: API_URL, existingApiKey: false, useBrowser: false },
      dependencies,
    );
    const outcome = expect(login).rejects.toThrow(/denied/i);
    await vi.advanceTimersByTimeAsync(7_000);

    await outcome;
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
    expect(dependencies.saveApiKey).not.toHaveBeenCalled();
  });

  it("reports expiration without saving a credential", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/api/auth/device/code")) {
        return jsonResponse({
          device_code: "device-code",
          user_code: "CODE",
          verification_uri: `${API_URL}/device`,
          expires_in: 2,
          interval: 1,
        });
      }
      return jsonResponse({ error: "authorization_pending" }, 400);
    }) as typeof fetch;
    const dependencies = createDependencies(fetchFn);

    const login = performDeviceLogin(
      { apiUrl: API_URL, existingApiKey: false, useBrowser: false },
      dependencies,
    );
    const outcome = expect(login).rejects.toThrow(/expired/i);
    await vi.advanceTimersByTimeAsync(2_000);

    await outcome;
    expect(dependencies.saveApiKey).not.toHaveBeenCalled();
  });

  it("fails after three consecutive polling network errors", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      if (input.toString().endsWith("/api/auth/device/code")) {
        return jsonResponse({
          device_code: "device-code",
          user_code: "CODE",
          verification_uri: `${API_URL}/device`,
          expires_in: 60,
          interval: 1,
        });
      }
      throw new Error("offline");
    }) as typeof fetch;
    const dependencies = createDependencies(fetchFn);

    const login = performDeviceLogin(
      { apiUrl: API_URL, existingApiKey: false, useBrowser: false },
      dependencies,
    );
    const outcome = expect(login).rejects.toThrow(/network connection/i);
    await vi.advanceTimersByTimeAsync(3_000);

    await outcome;
    expect(dependencies.saveApiKey).not.toHaveBeenCalled();
  });

  it("does not save the temporary session when finalization fails", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/api/auth/device/code")) {
        return jsonResponse({
          device_code: "device-code",
          user_code: "CODE",
          verification_uri: `${API_URL}/device`,
          expires_in: 60,
          interval: 1,
        });
      }
      if (url.endsWith("/api/auth/device/token")) {
        return jsonResponse({ access_token: TEMPORARY_TOKEN });
      }
      return jsonResponse({ success: false, error: { message: "grant missing" } }, 409);
    }) as typeof fetch;
    const dependencies = createDependencies(fetchFn);

    const login = performDeviceLogin(
      { apiUrl: API_URL, existingApiKey: false, useBrowser: false },
      dependencies,
    );
    const outcome = expect(login).rejects.toThrow(/finalize/i);
    await vi.advanceTimersByTimeAsync(1_000);

    await outcome;
    expect(dependencies.saveApiKey).not.toHaveBeenCalled();
    const terminalOutput = vi.mocked(dependencies.onStatus).mock.calls.flat().join("\n");
    expect(terminalOutput).not.toContain(TEMPORARY_TOKEN);
  });
});
