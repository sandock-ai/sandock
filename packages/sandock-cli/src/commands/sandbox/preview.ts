import { Args, Command, Flags } from "@oclif/core";
import { getClient } from "../../lib/client-helper.js";
import { validateSandboxId } from "../../lib/preview-input.js";

export default class SandboxPreview extends Command {
  static override description = "Generate a signed Preview URL for a sandbox port";

  static override examples = [
    "<%= config.bin %> <%= command.id %> sb_12345 --port 3000",
    "<%= config.bin %> <%= command.id %> sb_12345 --port 3000 --expires-in 7200",
  ];

  static override args = {
    id: Args.string({ description: "Sandbox ID", required: true }),
  };

  static override flags = {
    port: Flags.integer({
      description: "Sandbox application port",
      required: true,
      min: 1,
      max: 65535,
    }),
    "expires-in": Flags.integer({
      description: "Signed URL lifetime in seconds (independent of sandbox lifetime)",
      default: 3600,
      min: 60,
      max: 86400,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(SandboxPreview);
    try {
      validateSandboxId(args.id);
      const result = await getClient().sandbox.getSignedPreviewUrl(args.id, {
        port: flags.port,
        expiresIn: flags["expires-in"],
      });
      this.log(result.data.url);
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}
