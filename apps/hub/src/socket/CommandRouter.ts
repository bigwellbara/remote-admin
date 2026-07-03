import { Server, Socket } from "socket.io";
import {
  Command,
  CommandResponse,
  ClientType,
  HubEventType,
} from "@remote-admin/protocol";
import { ConnectedClient } from "./types.js";
import { HubEventBus } from "../events/HubEventBus.js";

interface PendingCommand {
  command: Command;
  issuerSocketId: string;
}

/**
 * Owns command dispatch + response relay.
 * HubServer hands it the client registry (read-only lookups), the
 * io instance, and the shared HubEventBus; CommandRouter never mutates
 * the client map directly and never talks to sockets/logs on its own.
 */
export class CommandRouter {
  private io: Server;
  private clients: Map<string, ConnectedClient>;
  private events: HubEventBus;
  private pendingCommands: Map<string, PendingCommand> = new Map();

  constructor(io: Server, clients: Map<string, ConnectedClient>, events: HubEventBus) {
    this.io = io;
    this.clients = clients;
    this.events = events;
  }

  public handleCommand(socket: Socket, payload: unknown) {
    const sender = this.getSender(socket);

    if (!sender) {
      socket.emit("command_error", {
        message: "Not authenticated",
      });
      return;
    }

    if (!this.isValidCommand(payload)) {
      socket.emit("command_error", {
        message: "Malformed command payload",
      });
      return;
    }

    const command = payload;

    // Only admins and the WhatsApp bot issue commands; agents are targets, not issuers.
    if (sender.type === ClientType.WINDOWS_AGENT) {
      socket.emit("command_error", {
        message: "This client type is not permitted to issue commands",
      });
      return;
    }

    this.events.emit(HubEventType.COMMAND_QUEUED, command);

    const target = this.clients.get(command.computerId);

    if (!target) {
      socket.emit("command_error", {
        message: `No connected agent for computerId "${command.computerId}"`,
        commandId: command.id,
      });
      this.events.emit(HubEventType.ERROR, {
        reason: "target_not_found",
        commandId: command.id,
      });
      return;
    }

    this.pendingCommands.set(command.id, {
      command,
      issuerSocketId: socket.id,
    });

    this.io.to(target.socketId).emit("command", command);
    this.events.emit(HubEventType.COMMAND_SENT, command);

    console.log(
      `[HUB] Command ${command.id} (${command.name}) routed to ${command.computerId}`
    );
  }

  public handleCommandResponse(socket: Socket, payload: unknown) {
    const sender = this.getSender(socket);

    if (!sender) {
      return;
    }

    if (!this.isValidResponse(payload)) {
      console.log("[HUB] Received malformed command_response, dropping");
      return;
    }

    const response = payload;
    const pending = this.pendingCommands.get(response.commandId);

    if (!pending) {
      console.log(
        `[HUB] Received response for unknown/expired command ${response.commandId}`
      );
      return;
    }

    this.io.to(pending.issuerSocketId).emit("command_response", response);
    this.pendingCommands.delete(response.commandId);

    this.events.emit(HubEventType.COMMAND_COMPLETED, response);

    console.log(
      `[HUB] Response for command ${response.commandId} relayed back to issuer`
    );
  }

  /** Drop any pending commands still waiting on a client that just disconnected. */
  public handleClientDisconnect(clientId: string) {
    for (const [commandId, pending] of this.pendingCommands.entries()) {
      if (pending.command.computerId === clientId) {
        this.io.to(pending.issuerSocketId).emit("command_error", {
          message: `Agent disconnected before completing command`,
          commandId,
        });
        this.pendingCommands.delete(commandId);
      }
    }
  }

  private getSender(socket: Socket): ConnectedClient | undefined {
    const clientId = socket.data?.clientId as string | undefined;
    if (!clientId) return undefined;
    return this.clients.get(clientId);
  }

  private isValidCommand(payload: unknown): payload is Command {
    if (!payload || typeof payload !== "object") return false;
    const c = payload as Partial<Command>;
    return (
      typeof c.id === "string" &&
      typeof c.computerId === "string" &&
      typeof c.name === "string" &&
      typeof c.issuedBy === "string" &&
      typeof c.timestamp === "number"
    );
  }

  private isValidResponse(payload: unknown): payload is CommandResponse {
    if (!payload || typeof payload !== "object") return false;
    const r = payload as Partial<CommandResponse>;
    return (
      typeof r.id === "string" &&
      typeof r.commandId === "string" &&
      typeof r.computerId === "string" &&
      typeof r.success === "boolean" &&
      typeof r.timestamp === "number"
    );
  }
}