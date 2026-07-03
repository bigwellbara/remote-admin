import { io, Socket } from "socket.io-client";
import os from "node:os";
import {
  ClientType,
  Command,
  createSuccessResponse,
  createErrorResponse,
} from "@remote-admin/protocol";
import { AgentTray } from "./tray.js";
import { runShellCommand, ShellCommandArgs } from "./executor.js";
import { logCommandExecution } from "./logger.js";

const HUB_URL = process.env.HUB_URL ?? "http://localhost:3000";
const COMPUTER_ID = process.env.COMPUTER_ID ?? os.hostname();

function isShellCommandArgs(value: unknown): value is ShellCommandArgs {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ShellCommandArgs).command === "string"
  );
}

async function handleCommand(socket: Socket, command: Command) {
  const startedAt = Date.now();

  if (command.name !== "shell") {
    socket.emit(
      "command_response",
      createErrorResponse({
        commandId: command.id,
        computerId: COMPUTER_ID,
        message: `Unsupported command "${command.name}"`,
        code: "UNSUPPORTED_COMMAND",
      })
    );
    return;
  }

  if (!isShellCommandArgs(command.args)) {
    socket.emit(
      "command_response",
      createErrorResponse({
        commandId: command.id,
        computerId: COMPUTER_ID,
        message: `Malformed args for "shell" command`,
        code: "INVALID_ARGS",
      })
    );
    return;
  }

  const result = await runShellCommand(command.args);
  const durationMs = Date.now() - startedAt;
  const success = result.exitCode === 0 && !result.timedOut;

  logCommandExecution({
    timestamp: startedAt,
    commandId: command.id,
    issuedBy: command.issuedBy,
    name: command.name,
    args: command.args,
    success,
    exitCode: result.exitCode,
    durationMs,
  });

  const response = success
    ? createSuccessResponse({
        commandId: command.id,
        computerId: COMPUTER_ID,
        data: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          durationMs,
        },
      })
    : createErrorResponse({
        commandId: command.id,
        computerId: COMPUTER_ID,
        message: result.timedOut
          ? "Command timed out"
          : `Command exited with code ${result.exitCode}`,
        code: result.timedOut ? "TIMEOUT" : "NONZERO_EXIT",
      });

  socket.emit("command_response", response);
}

async function main() {
  const tray = new AgentTray(COMPUTER_ID, () => {
    console.log("[AGENT] Quit requested from tray, exiting.");
    process.exit(0);
  });

  await tray.start();
  tray.setStatus("connecting");

  const socket = io(HUB_URL, {
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    console.log(`[AGENT] Connected to hub as ${socket.id}`);
    socket.emit("authenticate", {
      type: ClientType.WINDOWS_AGENT,
      clientId: COMPUTER_ID,
    });
  });

  socket.on("authenticated", () => {
    console.log(`[AGENT] Authenticated as ${COMPUTER_ID}`);
    tray.setStatus("connected", COMPUTER_ID);
  });

  socket.on("auth_error", (message: string) => {
    console.error("[AGENT] Auth failed:", message);
    tray.setStatus("disconnected");
  });

  socket.on("command", (command: Command) => {
    console.log(`[AGENT] Received command "${command.name}" (${command.id})`);
    void handleCommand(socket, command);
  });

  socket.on("disconnect", () => {
    console.log("[AGENT] Disconnected from hub");
    tray.setStatus("disconnected");
  });

  socket.on("connect_error", (err: Error) => {
    console.error("[AGENT] Connection error:", err.message);
  });
}

main().catch((err) => {
  console.error("[AGENT] Fatal error during startup:", err);
  process.exit(1);
});