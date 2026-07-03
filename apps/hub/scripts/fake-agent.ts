/**
 * Test-only fake agent. Simulates a Windows agent connecting to the hub,
 * authenticating, and responding to whatever command it receives.
 *
 * Run with: pnpm --filter @remote-admin/hub exec tsx scripts/fake-agent.ts
 */
import { io } from "socket.io-client";
import {
  ClientType,
  Command,
  createSuccessResponse,
} from "@remote-admin/protocol";

const COMPUTER_ID = "test-computer-01";
const HUB_URL = "http://localhost:3000";

const socket = io(HUB_URL);

socket.on("connect", () => {
  console.log(`[AGENT] Connected to hub as socket ${socket.id}`);

  socket.emit("authenticate", {
    type: ClientType.WINDOWS_AGENT,
    clientId: COMPUTER_ID,
  });
});

socket.on("authenticated", (payload) => {
  console.log("[AGENT] Authenticated:", payload);
});

socket.on("auth_error", (message) => {
  console.error("[AGENT] Auth failed:", message);
});

socket.on("command", (command: Command) => {
  console.log(`[AGENT] Received command "${command.name}"`, command);

  const response = createSuccessResponse({
    commandId: command.id,
    computerId: COMPUTER_ID,
    data: { message: `Pretend result for "${command.name}"` },
  });

  socket.emit("command_response", response);
  console.log(`[AGENT] Sent response for command ${command.id}`);
});

socket.on("disconnect", () => {
  console.log("[AGENT] Disconnected from hub");
});