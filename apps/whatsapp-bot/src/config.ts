export interface BotConfig {
  hubUrl: string;
  defaultComputerId: string;
  authorizedNumbers: string[];
  commandTimeoutMs: number;
}

function parseAuthorizedNumbers(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * Loads bot config from env and validates it up front. Deliberately throws
 * (rather than falling back to "allow everyone") if AUTHORIZED_NUMBERS is
 * missing — this bot must never accept commands from arbitrary numbers.
 */
export function loadConfig(): BotConfig {
  const authorizedNumbers = parseAuthorizedNumbers(process.env.AUTHORIZED_NUMBERS);

  if (authorizedNumbers.length === 0) {
    throw new Error(
      "AUTHORIZED_NUMBERS is not set. Refusing to start: this bot must not accept " +
        "commands from arbitrary WhatsApp numbers. Set it to a comma-separated list " +
        "of phone numbers in international format without '+' or spaces, " +
        "e.g. AUTHORIZED_NUMBERS=263771234567"
    );
  }

  const defaultComputerId = process.env.DEFAULT_COMPUTER_ID;
  if (!defaultComputerId) {
    throw new Error(
      "DEFAULT_COMPUTER_ID is not set. Set it to the target Windows agent's computerId " +
        "(the hostname it authenticated with, e.g. DESKTOP-T0U7ARQ)."
    );
  }

  return {
    hubUrl: process.env.HUB_URL ?? "http://localhost:3000",
    defaultComputerId,
    authorizedNumbers,
    commandTimeoutMs: Number(process.env.COMMAND_TIMEOUT_MS ?? 45_000),
  };
}

/** WhatsApp JIDs look like "263771234567@s.whatsapp.net" — compare just the number part. */
export function isAuthorizedJid(jid: string, authorizedNumbers: string[]): boolean {
  const number = jid.split("@")[0];
  return authorizedNumbers.includes(number);
}