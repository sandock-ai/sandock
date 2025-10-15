/**
 * Configuration management for Sandock CLI
 */

import Conf from "conf";

export interface SandockConfig {
  apiUrl: string;
  apiKey?: string;
}

const schema = {
  apiUrl: {
    type: "string" as const,
    default: "https://sandock.ai",
  },
  apiKey: {
    type: "string" as const,
  },
};

export class ConfigManager {
  private conf: Conf<SandockConfig>;

  constructor() {
    this.conf = new Conf<SandockConfig>({
      projectName: "sandock",
      schema,
    });
  }

  get apiUrl(): string {
    return this.conf.get("apiUrl");
  }

  set apiUrl(url: string) {
    this.conf.set("apiUrl", url);
  }

  get apiKey(): string | undefined {
    return this.conf.get("apiKey");
  }

  set apiKey(key: string | undefined) {
    if (key) {
      this.conf.set("apiKey", key);
    } else {
      this.conf.delete("apiKey");
    }
  }

  get all(): SandockConfig {
    return this.conf.store;
  }

  reset(): void {
    this.conf.clear();
  }

  get path(): string {
    return this.conf.path;
  }
}

export const config = new ConfigManager();
