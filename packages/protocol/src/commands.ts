import { randomUUID } from "node:crypto";

export interface Command<TArgs = unknown> {
  id: string;

  // target machine
  computerId: string;

  // command name: "screenshot", "cpu", etc
  name: string;

  // command parameters
  args: TArgs;

  // who issued it (whatsapp number or admin id)
  issuedBy: string;

  timestamp: number;

  // safety feature for destructive actions
  requiresConfirmation?: boolean;
}

export interface CreateCommandInput<TArgs = unknown> {
  computerId: string;
  name: string;
  args: TArgs;
  issuedBy: string;
  requiresConfirmation?: boolean;
}

/**
 * Builds a well-formed Command with a generated id and timestamp,
 * so callers (admin UI, WhatsApp bot, CLI) never hand-roll these fields.
 */
export function createCommand<TArgs = unknown>(
  input: CreateCommandInput<TArgs>
): Command<TArgs> {
  return {
    id: randomUUID(),
    computerId: input.computerId,
    name: input.name,
    args: input.args,
    issuedBy: input.issuedBy,
    timestamp: Date.now(),
    requiresConfirmation: input.requiresConfirmation,
  };
}