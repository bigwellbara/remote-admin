import fs from "node:fs";
import path from "node:path";

const LOG_PATH = path.join(process.cwd(), "logs", "agent-commands.log");

fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });

export interface LoggedCommandEntry {
  timestamp: number;
  commandId: string;
  issuedBy: string;
  name: string;
  args: unknown;
  success: boolean;
  exitCode?: number;
  durationMs: number;
}

/**
 * Local, on-disk record of every command this agent has executed.
 * This exists independently of the hub's own event log so there's always
 * a plain-text audit trail on the machine itself, even offline.
 */
export function logCommandExecution(entry: LoggedCommandEntry) {
  const line = JSON.stringify(entry) + "\n";
  fs.appendFile(LOG_PATH, line, (err) => {
    if (err) {
      console.error("[AGENT] Failed to write local command log:", err);
    }
  });
}