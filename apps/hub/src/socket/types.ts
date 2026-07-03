import { ClientType } from "@remote-admin/protocol";

export interface ConnectedClient {
  id: string;
  type: ClientType;
  socketId: string;
  connectedAt: number;
}