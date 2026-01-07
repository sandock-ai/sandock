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
    "<%= config.bin %> <%= command.id %> --image node:20",
    "<%= config.bin %> <%= command.id %> --image python:3.11 --space my-space",
    "<%= config.bin %> <%= command.id %> -i node:20-alpine",
  ];

  static override flags = {
    image: Flags.string({
      char: "i",
      description: "Docker image to use",
      required: true,
    }),
    space: Flags.string({
      char: "s",
      description: "Space ID (optional - uses personal space if not provided)",
    }),
    cpu: Flags.integer({
      char: "c",
      description: "CPU limit",
    }),
    memory: Flags.integer({
      char: "m",
      description: "Memory limit in MB",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(SandboxCreate);
    const client = getClient();
    const spinner = ora();

    try {
      spinner.start("Creating sandbox...");

      const result = await client.sandbox.create({
        image: flags.image,
        ...(flags.space && { spaceId: flags.space }),
        ...(flags.cpu && { cpu: flags.cpu }),
        ...(flags.memory && { memory: flags.memory }),
      });

      spinner.succeed(chalk.green("Sandbox created successfully!"));

      this.log(chalk.bold("\nSandbox Details:"));
      this.log(chalk.cyan("ID:"), result.data.id);

      this.log(chalk.gray(`\nTo interact with this sandbox, use:`));
      this.log(chalk.white(`  sandock sandbox info ${result.data.id}`));
    } catch (error) {
      spinner.fail(chalk.red("Failed to create sandbox"));
      this.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}
