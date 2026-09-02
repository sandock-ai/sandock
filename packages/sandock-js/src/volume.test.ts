import { describe, expect, it, vi } from "vitest";
import { createSandockClient, type VolumeInfo } from "./index";

const GIB = 1024 ** 3;
const volume: VolumeInfo = {
  id: "vol_test",
  spaceId: "space_test",
  name: "test-volume",
  status: "ready",
  storageType: "s3",
  sizeBytes: GIB,
  sizeUpdatedAt: "2026-09-01T00:05:00.000Z",
  sizeLimit: 50 * GIB,
  metadata: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const jsonResponse = (data: unknown): Response =>
  new Response(JSON.stringify({ success: true, code: 200, message: "SUCCESS", data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("Sandock volume size limit API", () => {
  it("passes sizeLimit when creating a volume", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(volume));
    const client = createSandockClient({
      baseUrl: "https://sandock.test",
      headers: { Authorization: "Bearer test" },
      fetch: fetchMock as typeof fetch,
    });

    await expect(
      client.volume.create("test-volume", { storageType: "s3", sizeLimit: 50 * GIB }),
    ).resolves.toEqual({ success: true, data: volume });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandock.test/api/v1/volume",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "test-volume",
          storageType: "s3",
          sizeLimit: 50 * GIB,
        }),
      }),
    );
  });

  it("sets an explicit volume size limit", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(volume));
    const client = createSandockClient({
      baseUrl: "https://sandock.test",
      fetch: fetchMock as typeof fetch,
    });

    await expect(client.volume.setSizeLimit(volume.id, 50 * GIB)).resolves.toEqual({
      success: true,
      data: volume,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://sandock.test/api/v1/volume/${volume.id}/size-limit`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ sizeLimit: 50 * GIB }),
      }),
    );
  });

  it("restores the subscription default when sizeLimit is omitted", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(volume));
    const client = createSandockClient({
      baseUrl: "https://sandock.test",
      fetch: fetchMock as typeof fetch,
    });

    await client.volume.setSizeLimit(volume.id);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://sandock.test/api/v1/volume/${volume.id}/size-limit`,
      expect.objectContaining({ method: "PATCH", body: "{}" }),
    );
  });
});
