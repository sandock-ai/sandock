import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import { config } from "../lib/config.js";
import {
  defaultDeviceLoginDependencies,
  openBrowser,
  performDeviceLogin,
} from "../lib/device-login.js";

export default class Login extends Command {
  static override description = "Sign in through a browser and create an API key";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --no-browser",
  ];

  static override flags = {
    "no-browser": Flags.boolean({
      description: "Print the authorization URL without opening a browser",
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Login);
    const runtime = defaultDeviceLoginDependencies();

    try {
      const result = await performDeviceLogin(
        {
          apiUrl: config.apiUrl,
          existingApiKey: Boolean(config.apiKey),
          useBrowser: !flags["no-browser"],
        },
        {
          ...runtime,
          confirmReplacement: async () => {
            const inquirer = await import("inquirer");
            const { replace } = await inquirer.default.prompt<{ replace: boolean }>([
              {
                type: "confirm",
                name: "replace",
                message: "An API key is already configured. Replace it?",
                default: false,
              },
            ]);
            return replace;
          },
          onStatus: (message) => this.log(message),
          openBrowser: (url) =>
            openBrowser(url, () => {
              this.log(
                chalk.yellow(
                  "Could not open a browser automatically. Open the URL above manually.",
                ),
              );
            }),
          saveApiKey: (apiKey) => {
            config.apiKey = apiKey;
          },
        },
      );

      if (result.status === "cancelled") {
        this.log(chalk.yellow("Login cancelled. The existing API key was kept."));
        return;
      }

      this.log(chalk.green("API key saved. You are signed in."));
      if (result.expiresAt) {
        this.log(chalk.gray(`Expires: ${result.expiresAt}`));
      }
    } catch (error) {
      this.error(chalk.red(error instanceof Error ? error.message : "Device sign-in failed."));
    }
  }
}
