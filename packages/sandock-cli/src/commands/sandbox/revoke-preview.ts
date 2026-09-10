import { Args, Command } from "@oclif/core";
import { getClient } from "../../lib/client-helper.js";
import { validatePreviewToken, validateSandboxId } from "../../lib/preview-input.js";

export default class SandboxRevokePreview extends Command {
  static override description = "Revoke a signed Preview token without deleting the sandbox";

  static override examples = ["<%= config.bin %> <%= command.id %> sb_12345 t0123456789abcde"];

  static override args = {
    id: Args.string({ description: "Sandbox ID that owns the Preview token", required: true }),
    token: Args.string({
      description: "Signed token from the generated Preview URL hostname",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(SandboxRevokePreview);
    try {
      validateSandboxId(args.id);
      validatePreviewToken(args.token);
      await getClient().sandbox.revokePreviewToken(args.id, args.token);
      this.log("Signed Preview URL revoked.");
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}
