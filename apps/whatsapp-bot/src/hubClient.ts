import { io, Socket } from "socket.io-client";
import {
  ClientType,
  Command,
  CommandResponse,
  createCommand,
} from "@remote-admin/protocol";

interface PendingReply {
  resolve: (response: CommandResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface HubClientOptions {
  hubUrl: string;
  botId: string;
  commandTimeoutMs: number;
}

/**
 * Thin promise-based wrapper around the hub socket, scoped to what the
 * WhatsApp bot needs: authenticate once as WHATSAPP_BOT, then send commands
 * and await their matching response by commandId.
 */
export class HubClient {
  private socket: Socket;
  private pending: Map<string, PendingReply> = new Map();
  private botId: string;
  private commandTimeoutMs: number;
  private authenticated = false;

  constructor(options: HubClientOptions) {
    this.botId = options.botId;
    this.commandTimeoutMs = options.commandTimeoutMs;

    this.socket = io(options.hubUrl, {
      reconnection: true,
      reconnectionDelay: 2000,
    });

    this.registerHandlers();
  }

  private registerHandlers() {
    this.socket.on("connect", () => {
      console.log(`[BOT] Connected to hub as ${this.socket.id}`);
      this.socket.emit("authenticate", {
        type: ClientType.WHATSAPP_BOT,
        clientId: this.botId,
      });
    });

    this.socket.on("authenticated", () => {
      this.authenticated = true;
      console.log(`[BOT] Authenticated with hub as ${this.botId}`);
    });

    this.socket.on("auth_error", (message: string) => {
      console.error("[BOT] Hub auth failed:", message);
    });

    this.socket.on("command_response", (response: CommandResponse) => {
      this.resolvePending(response.commandId, response);
    });

    this.socket.on("command_error", (error: { message: string; commandId?: string }) => {
      if (!error.commandId) {
        console.error("[BOT] Command error with no commandId:", error.message);
        return;
      }
      this.rejectPending(error.commandId, new Error(error.message));
    });

    this.socket.on("disconnect", () => {
      this.authenticated = false;
      console.log("[BOT] Disconnected from hub");
    });

    this.socket.on("connect_error", (err: Error) => {
      console.error("[BOT] Hub connection error:", err.message);
    });
  }

  public isReady(): boolean {
    return this.authenticated;
  }

  public sendShellCommand(input: {
    computerId: string;
    shellCommand: string;
    shell: "cmd" | "powershell";
    issuedBy: string;
  }): Promise<CommandResponse> {
    const command: Command = createCommand({
      computerId: input.computerId,
      name: "shell",
      args: { command: input.shellCommand, shell: input.shell },
      issuedBy: input.issuedBy,
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.id);
        reject(new Error("Timed out waiting for a response from the agent"));
      }, this.commandTimeoutMs);

      this.pending.set(command.id, { resolve, reject, timer });
      this.socket.emit("command", command);
    });
  }

  private resolvePending(commandId: string, response: CommandResponse) {
    const pending = this.pending.get(commandId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(commandId);
    pending.resolve(response);
  }

  private rejectPending(commandId: string, error: Error) {
    const pending = this.pending.get(commandId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(commandId);
    pending.reject(error);
  }
}