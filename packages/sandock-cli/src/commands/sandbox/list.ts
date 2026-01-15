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

      const result = await client.sandbox.list(flags.space ? { spaceId: flags.space } : undefined);

      const sandboxes = result.data.items || [];

      if (sandboxes.length === 0) {
        this.log(chalk.yellow("\nNo sandboxes found"));
        return;
      }

      this.log(chalk.bold(`\nFound ${sandboxes.length} sandbox(es):\n`));

      for (const sandbox of sandboxes.slice(0, flags.limit)) {
        this.log(chalk.green(`● ${sandbox.id}`));
        this.log(`  Status: ${chalk.gray(sandbox.status)}`);
        if (sandbox.image) {
          this.log(`  Image: ${chalk.gray(sandbox.image)}`);
        }
        this.log("");
      }
    } catch (error) {
      this.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}
