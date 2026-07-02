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