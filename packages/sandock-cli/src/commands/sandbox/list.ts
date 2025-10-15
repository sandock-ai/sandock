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
  ];

  static override flags = {
    limit: Flags.integer({
      char: "l",
      description: "Maximum number of sandboxes to list",
      default: 20,
    }),
    namespace: Flags.string({
      char: "s",
      description: "Namespace (space ID)",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(SandboxList);
    const client = getClient();
    const namespace = flags.namespace?.trim();
    const spaceId =
      namespace !== undefined ? (namespace.length > 0 ? namespace : undefined) : "default";
    const requestOptions = spaceId
      ? { params: { query: { spaceId } } }
      : undefined;

    try {
      this.log(chalk.cyan("Fetching sandboxes..."));

      const { data, error } = await client.GET("/api/sandbox", requestOptions);

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
