/**
 * Sandbox create command
 */

import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { getClient } from "../../lib/client-helper.js";

export default class SandboxCreate extends Command {
  static override description = "Create a new sandbox";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --name my-sandbox",
    "<%= config.bin %> <%= command.id %> --name my-sandbox --image node:20",
    "<%= config.bin %> <%= command.id %> -n python-env -i python:3.11",
  ];

  static override flags = {
    name: Flags.string({
      char: "n",
      description: "Sandbox name",
      required: true,
    }),
    image: Flags.string({
      char: "i",
      description: "Docker image to use (default: sandockai/sandock-code:latest on server)",
    }),
    space: Flags.string({
      char: "s",
      description: "Space ID (optional - uses personal space if not provided)",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(SandboxCreate);
    const client = getClient();
    const spinner = ora();

    try {
      spinner.start("Creating sandbox...");

      const { data, error } = await client.POST("/api/sandbox", {
        body: {
          ...(flags.space && { spaceId: flags.space }),
          name: flags.name,
          ...(flags.image && { image: flags.image }),
        },
      });

      if (error || !data) {
        spinner.fail(chalk.red("Failed to create sandbox"));
        this.error(chalk.red(`Error: ${JSON.stringify(error)}`));
      }

      spinner.succeed(chalk.green("Sandbox created successfully!"));

      this.log(chalk.bold("\nSandbox Details:"));
      this.log(chalk.cyan("ID:"), data.data.id);

      this.log(chalk.gray(`\nTo interact with this sandbox, use:`));
      this.log(chalk.white(`  sandock sandbox info ${data.data.id}`));
    } catch (error) {
      spinner.fail(chalk.red("Failed to create sandbox"));
      this.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}
