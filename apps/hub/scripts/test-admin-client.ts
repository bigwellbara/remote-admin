/**
 * Test-only fake admin. Connects to the hub, authenticates as HUB_ADMIN,
 * fires a command at a target computer, and prints whatever comes back.
 *
 * Run with: pnpm --filter @remote-admin/hub exec tsx scripts/test-admin-client.ts
 */
import { io } from "socket.io-client";
import { ClientType, createCommand } from "@remote-admin/protocol";

const ADMIN_ID = "test-admin-01";
const TARGET_COMPUTER_ID = "test-computer-01";
const HUB_URL = "http://localhost:3000";

const socket = io(HUB_URL);

socket.on("connect", () => {
  console.log(`[ADMIN] Connected to hub as socket ${socket.id}`);

  socket.emit("authenticate", {
    type: ClientType.HUB_ADMIN,
    clientId: ADMIN_ID,
  });
});

socket.on("authenticated", (payload) => {
  console.log("[ADMIN] Authenticated:", payload);

  // const command = createCommand({
  //   computerId: TARGET_COMPUTER_ID,
  //   name: "screenshot",
  //   args: {},
  //   issuedBy: ADMIN_ID,
  // });

  const command = createCommand({
  computerId: "DESKTOP-T0U7ARQ",
  name: "shell",
  args: { command: "echo hello from remote-admin", shell: "cmd" },
  issuedBy: ADMIN_ID,
});

  console.log("[ADMIN] Sending command:", command);
  socket.emit("command", command);
});

socket.on("command_error", (error) => {
  console.error("[ADMIN] Command error:", error);
});

socket.on("command_response", (response) => {
  console.log("[ADMIN] Received command_response:", response);
});

socket.on("hub_event", (event) => {
  console.log("[ADMIN] hub_event:", event);
});

socket.on("disconnect", () => {
  console.log("[ADMIN] Disconnected from hub");
});