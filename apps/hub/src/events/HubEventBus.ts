import { Server } from "socket.io";
import fs from "node:fs";
import path from "node:path";
import { ClientType, HubEvent, HubEventType } from "@remote-admin/protocol";
import { ConnectedClient } from "../socket/types.js";

/**
 * Single place events pass through: every HubEvent gets broadcast to
 * connected HUB_ADMIN clients in real time AND appended to a JSONL log
 * file on disk, so nothing is lost if no admin happens to be watching.
 */
export class HubEventBus {
  private io: Server;
  private clients: Map<string, ConnectedClient>;
  private logFilePath: string;

  constructor(
    io: Server,
    clients: Map<string, ConnectedClient>,
    logFilePath: string = path.join(process.cwd(), "logs", "hub-events.log")
  ) {
    this.io = io;
    this.clients = clients;
    this.logFilePath = logFilePath;
    fs.mkdirSync(path.dirname(this.logFilePath), { recursive: true });
  }

  public emit<T>(type: HubEventType, payload: T): HubEvent<T> {
    const event: HubEvent<T> = {
      type,
      timestamp: Date.now(),
      payload,
    };

    this.broadcast(event);
    this.persist(event);

    return event;
  }

  private broadcast<T>(event: HubEvent<T>) {
    for (const client of this.clients.values()) {
      if (client.type === ClientType.HUB_ADMIN) {
        this.io.to(client.socketId).emit("hub_event", event);
      }
    }
  }

  private persist<T>(event: HubEvent<T>) {
    const line = JSON.stringify(event) + "\n";
    fs.appendFile(this.logFilePath, line, (err) => {
      if (err) {
        console.error("[HUB] Failed to persist event to log:", err);
      }
    });
  }
}