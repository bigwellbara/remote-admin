import { WAMessage } from "@whiskeysockets/baileys";
import { loadConfig, isAuthorizedJid } from "./config.js";
import { parseMessage, getHelpText } from "./commands.js";
import { HubClient } from "./hubClient.js";
import { connectWhatsApp } from "./whatsapp.js";

const BOT_ID = "whatsapp-bot-01";

function extractText(msg: WAMessage): string | null {
  const message = msg.message;
  if (!message) return null;
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    null
  );
}

async function main() {
  const config = loadConfig();

  console.log(
    `[BOT] Starting. Authorized numbers: ${config.authorizedNumbers.join(", ")}`
  );
  console.log(`[BOT] Default target computer: ${config.defaultComputerId}`);

  const hub = new HubClient({
    hubUrl: config.hubUrl,
    botId: BOT_ID,
    commandTimeoutMs: config.commandTimeoutMs,
  });

  const wa = await connectWhatsApp();

  wa.onMessage(async (msg) => {
    if (msg.key.fromMe) return; // ignore the bot's own outgoing messages

    const jid = msg.key.remoteJid;
    if (!jid) return;

    if (!isAuthorizedJid(jid, config.authorizedNumbers)) {
      console.log(`[BOT] Ignored message from unauthorized sender: ${jid}`);
      return;
    }

    const text = extractText(msg);
    if (!text) return;

    const parsed = parseMessage(text);

    if (parsed.kind === "ignore") return;

    if (parsed.kind === "help") {
      await wa.sock.sendMessage(jid, { text: getHelpText() });
      return;
    }

    // parsed.kind === "shell"
    const { shellCommand, shell } = parsed.intent;

    if (!hub.isReady()) {
      await wa.sock.sendMessage(jid, {
        text: "Not connected to the hub yet — try again in a moment.",
      });
      return;
    }

    await wa.sock.sendMessage(jid, {
      text: `Running: ${shellCommand}`,
    });

    try {
      const response = await hub.sendShellCommand({
        computerId: config.defaultComputerId,
        shellCommand,
        shell,
        issuedBy: jid,
      });

      if (response.success) {
        const data = response.data as
          | { stdout?: string; stderr?: string; exitCode?: number }
          | undefined;
        const stdout = data?.stdout?.trim();
        const stderr = data?.stderr?.trim();

        let reply = `✅ Exit code ${data?.exitCode ?? 0}`;
        if (stdout) reply += `\n\n${stdout}`;
        if (stderr) reply += `\n\n[stderr]\n${stderr}`;

        await wa.sock.sendMessage(jid, { text: reply });
      } else {
        await wa.sock.sendMessage(jid, {
          text: `❌ ${response.error?.message ?? "Command failed"}`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await wa.sock.sendMessage(jid, { text: `❌ ${message}` });
    }
  });
}

main().catch((err) => {
  console.error("[BOT] Fatal error during startup:", err);
  process.exit(1);
});