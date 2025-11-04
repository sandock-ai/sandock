/**
 * Sandbox list command
 */

import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import { getClient } from "../../lib/client-helper.js";

export default class SandboxList extends Command {
  static override description = "List all sandboxes";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --limit 50",
    "<%= config.bin %> <%= command.id %> --space my-space",
  ];

  static override flags = {
    limit: Flags.integer({
      char: "l",
      description: "Maximum number of sandboxes to list",
      default: 20,
    }),
    space: Flags.string({
      char: "s",
      description: "Space ID (optional - uses personal space if not provided)",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(SandboxList);
    const client = getClient();

    try {
      this.log(chalk.cyan("Fetching sandboxes..."));

      const requestParams = flags.space
        ? { params: { query: { spaceId: flags.space } } }
        : undefined;

      // biome-ignore lint/suspicious/noExplicitAny: Schema is outdated - spaceId query param is optional
      const { data, error } = await client.GET("/api/sandbox", requestParams as any);

      if (error || !data) {
        this.error(chalk.red(`Failed to fetch sandboxes: ${error || "Unknown error"}`));
      }

      const sandboxes = data.data?.items || [];

      if (sandboxes.length === 0) {
        this.log(chalk.yellow("\nNo sandboxes found"));
        return;
      }

      this.log(chalk.bold(`\nFound ${sandboxes.length} sandbox(es):\n`));

      for (const sandbox of sandboxes.slice(0, flags.limit)) {
        this.log(chalk.green(`● ${sandbox.id}`));
        this.log(`  ID: ${chalk.gray(sandbox.id)}`);
        this.log("");
      }
    } catch (error) {
      this.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}
