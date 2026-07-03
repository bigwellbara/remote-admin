import { exec, execFile } from "node:child_process";

export interface ShellCommandArgs {
  command: string;
  shell?: "cmd" | "powershell";
  timeoutMs?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB, generous for command output

interface ExecCallbackError extends Error {
  code?: string | number | null;
  killed?: boolean;
}

export function runShellCommand(
  args: ShellCommandArgs
): Promise<ExecutionResult> {
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    const callback = (
      error: ExecCallbackError | null,
      stdout: string,
      stderr: string
    ) => {
      resolve({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        exitCode: error ? (typeof error.code === "number" ? error.code : 1) : 0,
        timedOut: Boolean(error?.killed),
      });
    };

    if (args.shell === "powershell") {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", args.command],
        { timeout: timeoutMs, maxBuffer: MAX_BUFFER, encoding: "utf8" },
        callback
      );
    } else {
      exec(
        args.command,
        { timeout: timeoutMs, maxBuffer: MAX_BUFFER },
        callback
      );
    }
  });
}