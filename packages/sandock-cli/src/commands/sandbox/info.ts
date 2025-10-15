/**
 * Sandbox info command - Get detailed information about a sandbox
 */

import { Args, Command } from "@oclif/core";
import chalk from "chalk";
import { getClient } from "../../lib/client-helper.js";

export default class SandboxInfo extends Command {
  static override description = "Get detailed information about a sandbox";

  static override examples = ["<%= config.bin %> <%= command.id %> sb_12345"];

  static override args = {
    id: Args.string({
      description: "Sandbox ID",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(SandboxInfo);
    const client = getClient();

    try {
      const { data, error } = await client.GET("/api/user/{id}", {
        params: { path: { id: args.id } },
      });

      if (error || !data) {
        this.error(chalk.red(`Failed to get sandbox info: ${JSON.stringify(error)}`));
      }

      const info = data.data;

      this.log(chalk.bold("\n📦 Sandbox Information\n"));

      if (typeof info === "object" && info !== null) {
        this.log(JSON.stringify(info, null, 2));
      } else {
        this.log(chalk.gray("No detailed information available"));
      }
    } catch (error) {
      this.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}
