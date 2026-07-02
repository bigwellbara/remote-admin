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