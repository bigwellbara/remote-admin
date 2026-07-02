export enum ClientType {
  WHATSAPP_BOT = "WHATSAPP_BOT",
  WINDOWS_AGENT = "WINDOWS_AGENT",
  HUB_ADMIN = "HUB_ADMIN",
}

export interface BaseClient {
  id: string;
  type: ClientType;
  connectedAt: number;
}