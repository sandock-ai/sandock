import { implement } from "@orpc/server";
import { sandboxBaseContract } from "sandock-contract/contract/sandbox";
import { createSuccessResponse } from "sandock-contract/types";
import type { SandboxManager } from "../sandbox-manager";
import type { SandboxApiContext } from "./context";
import {
  type CreateSandboxFn,
  defaultCreateSandbox,
  opDelete,
  opList,
  opListFiles,
  opPause,
  opReadFile,
  opRemoveFile,
  opResume,
  opRunCode,
  opShell,
  opStart,
  opStop,
  opWriteFile,
} from "./ops";

export interface CreateSandboxRouterOptions {
  /**
   * Reserve + start a sandbox and return its id. Injected by the host to add tenant policy
   * (sandock: plan quota + onboarding). Default: unlimited, no tenant coupling (sandock-open).
   */
  createSandbox?: CreateSandboxFn;
}

/**
 * Build the base sandbox oRPC router (lifecycle + exec + fs) for the base contract, wired to a
 * `SandboxManager`. Handlers read the per-request `actor` from context (set directly by the host,
 * e.g. apps/sandock's fixed local actor) and delegate to the shared ops in ./ops.ts. apps/sandock-cloud
 * implements the cloud (superset) contract separately but reuses the same ops for behavior parity.
 */
export function createSandboxRouter(
  manager: SandboxManager,
  options: CreateSandboxRouterOptions = {},
) {
  const os = implement(sandboxBaseContract).$context<SandboxApiContext>();
  const createSandbox = options.createSandbox ?? defaultCreateSandbox(manager);

  return os.router({
    create: os.create.handler(async ({ input, context }) =>
      createSuccessResponse(await createSandbox(input, context.actor)),
    ),
    list: os.list.handler(async ({ context }) =>
      createSuccessResponse(await opList(manager, context.actor)),
    ),
    start: os.start.handler(async ({ input }) =>
      createSuccessResponse(await opStart(manager, input.id)),
    ),
    stop: os.stop.handler(async ({ input }) =>
      createSuccessResponse(await opStop(manager, input.id)),
    ),
    pause: os.pause.handler(async ({ input }) =>
      createSuccessResponse(await opPause(manager, input.id)),
    ),
    resume: os.resume.handler(async ({ input }) =>
      createSuccessResponse(await opResume(manager, input.id)),
    ),
    delete: os.delete.handler(async ({ input }) =>
      createSuccessResponse(await opDelete(manager, input.id)),
    ),
    runCode: os.runCode.handler(async ({ input }) =>
      createSuccessResponse(await opRunCode(manager, input.id, input)),
    ),
    shell: os.shell.handler(async ({ input }) =>
      createSuccessResponse(await opShell(manager, input.id, input)),
    ),
    writeFile: os.writeFile.handler(async ({ input }) =>
      createSuccessResponse(await opWriteFile(manager, input.id, input)),
    ),
    readFile: os.readFile.handler(async ({ input }) =>
      createSuccessResponse(await opReadFile(manager, input.id, input.path)),
    ),
    listFiles: os.listFiles.handler(async ({ input }) =>
      createSuccessResponse(await opListFiles(manager, input.id, input.path)),
    ),
    removeFile: os.removeFile.handler(async ({ input }) =>
      createSuccessResponse(await opRemoveFile(manager, input.params.id, input.query.path)),
    ),
  });
}

export type SandboxRouter = ReturnType<typeof createSandboxRouter>;
