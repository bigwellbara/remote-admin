export enum HubEventType {
  CLIENT_CONNECTED = "CLIENT_CONNECTED",
  CLIENT_DISCONNECTED = "CLIENT_DISCONNECTED",

  COMMAND_QUEUED = "COMMAND_QUEUED",
  COMMAND_SENT = "COMMAND_SENT",
  COMMAND_COMPLETED = "COMMAND_COMPLETED",

  AUTH_FAILED = "AUTH_FAILED",
  ERROR = "ERROR",
}

export interface HubEvent<T = unknown> {
  type: HubEventType;
  timestamp: number;
  payload: T;
}