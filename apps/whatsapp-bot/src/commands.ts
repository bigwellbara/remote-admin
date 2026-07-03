export interface ParsedShellIntent {
  shellCommand: string;
  shell: "cmd" | "powershell";
}

export type ParseResult =
  | { kind: "shell"; intent: ParsedShellIntent }
  | { kind: "help" }
  | { kind: "ignore" };

const HELP_TEXT = [
  "*remote-admin bot*",
  "",
  "!run <command>   — run a command via cmd.exe",
  "!ps <command>    — run a command via PowerShell",
  "!help            — show this message",
].join("\n");

export function parseMessage(text: string): ParseResult {
  const trimmed = text.trim();

  if (trimmed === "!help") {
    return { kind: "help" };
  }

  if (trimmed.startsWith("!run ")) {
    const shellCommand = trimmed.slice("!run ".length).trim();
    if (!shellCommand) return { kind: "help" };
    return { kind: "shell", intent: { shellCommand, shell: "cmd" } };
  }

  if (trimmed.startsWith("!ps ")) {
    const shellCommand = trimmed.slice("!ps ".length).trim();
    if (!shellCommand) return { kind: "help" };
    return { kind: "shell", intent: { shellCommand, shell: "powershell" } };
  }

  return { kind: "ignore" };
}

export function getHelpText(): string {
  return HELP_TEXT;
}