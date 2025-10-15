/**
 * Config command - Manage Sandock CLI configuration
 */

import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import { config } from "../lib/config.js";

export default class Config extends Command {
  static override description = "Manage Sandock CLI configuration";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --show",
    "<%= config.bin %> <%= command.id %> --set-url https://sandock.ai",
    "<%= config.bin %> <%= command.id %> --set-key your-api-key",
    "<%= config.bin %> <%= command.id %> --reset",
  ];

  static override flags = {
    show: Flags.boolean({
      char: "s",
      description: "Show current configuration",
    }),
    "set-url": Flags.string({
      description: "Set API URL",
    }),
    "set-key": Flags.string({
      description: "Set API key",
    }),
    reset: Flags.boolean({
      description: "Reset configuration to defaults",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Config);

    // Reset configuration
    if (flags.reset) {
      config.reset();
      this.log(chalk.green("✓ Configuration reset to defaults"));
      return;
    }

    // Set API URL
    if (flags["set-url"]) {
      config.apiUrl = flags["set-url"];
      this.log(chalk.green(`✓ API URL set to: ${flags["set-url"]}`));
    }

    // Set API key
    if (flags["set-key"]) {
      config.apiKey = flags["set-key"];
      this.log(chalk.green("✓ API key saved"));
    }

    // Show configuration
    if (flags.show || (!flags["set-url"] && !flags["set-key"] && !flags.reset)) {
      this.log(chalk.bold("\nCurrent Configuration:"));
      this.log(chalk.cyan("API URL:"), config.apiUrl);
      this.log(
        chalk.cyan("API Key:"),
        config.apiKey ? "***" + config.apiKey.slice(-4) : chalk.gray("(not set)"),
      );
      this.log(chalk.gray(`\nConfig file: ${config.path}`));
    }
  }
}
