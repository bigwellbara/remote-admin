import { randomUUID } from "node:crypto";

export interface CommandResponse<TData = unknown> {
  id: string;

  commandId: string;

  computerId: string;

  success: boolean;

  data?: TData;

  error?: {
    message: string;
    code?: string;
  };

  timestamp: number;
}

export interface CreateSuccessResponseInput<TData = unknown> {
  commandId: string;
  computerId: string;
  data?: TData;
}

export interface CreateErrorResponseInput {
  commandId: string;
  computerId: string;
  message: string;
  code?: string;
}

export function createSuccessResponse<TData = unknown>(
  input: CreateSuccessResponseInput<TData>
): CommandResponse<TData> {
  return {
    id: randomUUID(),
    commandId: input.commandId,
    computerId: input.computerId,
    success: true,
    data: input.data,
    timestamp: Date.now(),
  };
}

export function createErrorResponse(
  input: CreateErrorResponseInput
): CommandResponse<never> {
  return {
    id: randomUUID(),
    commandId: input.commandId,
    computerId: input.computerId,
    success: false,
    error: {
      message: input.message,
      code: input.code,
    },
    timestamp: Date.now(),
  };
}