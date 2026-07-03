import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { ClientType, HubEventType } from "@remote-admin/protocol";
import { ConnectedClient } from "./types.js";
import { CommandRouter } from "./CommandRouter.js";
import { HubEventBus } from "../events/HubEventBus.js";

export class HubServer {
  private io: Server;
  private clients: Map<string, ConnectedClient> = new Map();
  private events: HubEventBus;
  private router: CommandRouter;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: "*",
      },
    });

    this.events = new HubEventBus(this.io, this.clients);
    this.router = new CommandRouter(this.io, this.clients, this.events);

    this.registerEvents();
  }

  public start() {
    console.log("[HUB] Server initialized");
  }

  private registerEvents() {
    this.io.on("connection", (socket: Socket) => {
      console.log(`[HUB] New connection: ${socket.id}`);

      socket.on("authenticate", (payload) => {
        const { type, clientId } = payload;

        if (!type || !clientId) {
          socket.emit("auth_error", "Invalid auth payload");
          this.events.emit(HubEventType.AUTH_FAILED, {
            socketId: socket.id,
            reason: "missing type or clientId",
          });
          socket.disconnect();
          return;
        }

        const client: ConnectedClient = {
          id: clientId,
          type,
          socketId: socket.id,
          connectedAt: Date.now(),
        };

        this.clients.set(clientId, client);

        // Stash identity on the socket so later events (command, command_response)
        // can resolve "who sent this" in O(1) without scanning the client map.
        socket.data.clientId = clientId;
        socket.data.clientType = type;

        socket.emit("authenticated", {
          success: true,
          clientId,
        });

        this.events.emit(HubEventType.CLIENT_CONNECTED, client);

        console.log(`[HUB] Authenticated: ${clientId} (${type})`);
      });

      socket.on("command", (payload) => {
        this.router.handleCommand(socket, payload);
      });

      socket.on("command_response", (payload) => {
        this.router.handleCommandResponse(socket, payload);
      });

      socket.on("disconnect", () => {
        for (const [id, client] of this.clients.entries()) {
          if (client.socketId === socket.id) {
            this.clients.delete(id);
            this.router.handleClientDisconnect(id);
            this.events.emit(HubEventType.CLIENT_DISCONNECTED, { id, type: client.type });
            console.log(`[HUB] Disconnected: ${id}`);
            break;
          }
        }
      });
    });
  }

  public getClients() {
    return Array.from(this.clients.values());
  }
}