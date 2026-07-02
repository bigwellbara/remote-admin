import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { ClientType } from "@remote-admin/protocol";

interface ConnectedClient {
  id: string;
  type: ClientType;
  socketId: string;
  connectedAt: number;
}

export class HubServer {
  private io: Server;
  private clients: Map<string, ConnectedClient> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: "*",
      },
    });

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

        socket.emit("authenticated", {
          success: true,
          clientId,
        });

        console.log(`[HUB] Authenticated: ${clientId} (${type})`);
      });

      socket.on("disconnect", () => {
        for (const [id, client] of this.clients.entries()) {
          if (client.socketId === socket.id) {
            this.clients.delete(id);
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