// export interface ParsedShellIntent {
//   shellCommand: string;
//   shell: "cmd" | "powershell";
// }

// export type ParseResult =
//   | { kind: "shell"; intent: ParsedShellIntent }
//   | { kind: "help" }
//   | { kind: "ignore" };

// const HELP_TEXT = [
//   "*remote-admin bot*",
//   "",
//   "!run <command>   — run a command via cmd.exe",
//   "!ps <command>    — run a command via PowerShell",
//   "!help            — show this message",
// ].join("\n");

// export function parseMessage(text: string): ParseResult {
//   const trimmed = text.trim();

//   if (trimmed === "!help") {
//     return { kind: "help" };
//   }

//   if (trimmed.startsWith("!run ")) {
//     const shellCommand = trimmed.slice("!run ".length).trim();
//     if (!shellCommand) return { kind: "help" };
//     return { kind: "shell", intent: { shellCommand, shell: "cmd" } };
//   }

//   if (trimmed.startsWith("!ps ")) {
//     const shellCommand = trimmed.slice("!ps ".length).trim();
//     if (!shellCommand) return { kind: "help" };
//     return { kind: "shell", intent: { shellCommand, shell: "powershell" } };
//   }

//   return { kind: "ignore" };
// }

// export function getHelpText(): string {
//   return HELP_TEXT;
// }

export interface ParsedShellIntent {
  shellCommand: string;
  shell: "cmd" | "powershell";
}

export type ParseResult =
  | { kind: "shell"; intent: ParsedShellIntent }
  | { kind: "confirm" }
  | { kind: "cancel" }
  | { kind: "help" }
  | { kind: "ignore" };

const HELP_TEXT = [
  "*remote-admin bot*",
  "",
  "!run <command>   — run a command via cmd.exe",
  "!ps <command>    — run a command via PowerShell",
  "!help            — show this message",
  "",
  "Destructive-looking commands require confirmation:",
  "!yes / !no       — confirm or cancel a pending command",
].join("\n");

const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+(-\w*r\w*f\w*|-\w*f\w*r\w*)\b/i,
  /\bdel\s+\/[sf]/i,
  /\brmdir\s+\/s/i,
  /\bdd\s+if=.*of=\/dev\//i,
  /\bmkfs(\.\w+)?\b/i,
  /\bshutdown\b|\brestart-computer\b/i,
  /\bgit\s+push\s+.*--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bremove-item\s+.*-recurse/i,
  /\bformat\s+[a-z]:/i,
  /\bDROP\s+(TABLE|DATABASE)\b/i,
];

export function isDestructive(shellCommand: string): boolean {
  return DESTRUCTIVE_PATTERNS.some((re) => re.test(shellCommand));
}

export function parseMessage(text: string): ParseResult {
  const trimmed = text.trim();

  if (trimmed === "!help") {
    return { kind: "help" };
  }

  if (trimmed === "!yes") {
    return { kind: "confirm" };
  }

  if (trimmed === "!no") {
    return { kind: "cancel" };
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