/**
 * Sandbox delete command - Delete a sandbox
 */

import { Args, Command, Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { getClient } from "../../lib/client-helper.js";

export default class SandboxDelete extends Command {
  static override description = "Delete a sandbox";

  static override examples = [
    "<%= config.bin %> <%= command.id %> sb_12345",
    "<%= config.bin %> <%= command.id %> sb_12345 --force",
  ];

  static override args = {
    id: Args.string({
      description: "Sandbox ID",
      required: true,
    }),
  };

  static override flags = {
    force: Flags.boolean({
      char: "f",
      description: "Skip confirmation prompt",
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(SandboxDelete);
    const client = getClient();
    const spinner = ora();

    // Confirmation prompt unless --force is used
    if (!flags.force) {
      const inquirer = await import("inquirer");
      const { confirm } = await inquirer.default.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: `Are you sure you want to delete sandbox ${chalk.cyan(args.id)}?`,
          default: false,
        },
      ]);

      if (!confirm) {
        this.log(chalk.yellow("Delete cancelled"));
        return;
      }
    }

    try {
      spinner.start(`Deleting sandbox ${args.id}...`);

      const { data, error } = await client.DELETE("/api/v1/sandbox/{id}", {
        params: {
          path: { id: args.id },
        },
      });

      if (error || !data) {
        spinner.fail(chalk.red("Failed to delete sandbox"));
        this.error(chalk.red(`Error: ${JSON.stringify(error)}`));
      }

      spinner.succeed(chalk.green("Sandbox deleted successfully!"));

      this.log(chalk.bold("\n✨ Delete Result:"));
      this.log(chalk.cyan("Sandbox ID:"), data.data.id);
      this.log(chalk.cyan("Deleted:"), data.data.deleted ? "Yes" : "No");
    } catch (error) {
      spinner.fail(chalk.red("Failed to delete sandbox"));
      this.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}
