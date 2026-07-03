// import "dotenv/config";
// import { WAMessage, jidNormalizedUser } from "@whiskeysockets/baileys";
// import { loadConfig } from "./config.js";
// import { parseMessage, getHelpText } from "./commands.js";
// import { HubClient } from "./hubClient.js";
// import { connectWhatsApp } from "./whatsapp.js";

// const BOT_ID = "whatsapp-bot-01";

// function extractText(msg: WAMessage): string | null {
//   const m = msg.message;
//   if (!m) return null;

//   // 1. direct text
//   const direct = m.conversation ?? m.extendedTextMessage?.text;
//   if (direct) return direct;

//   // 2. ephemeral wrapper (common for self-chat / disappearing messages)
//   const ephemeral = m.ephemeralMessage?.message;
//   if (ephemeral) {
//     return (
//       ephemeral.conversation ??
//       ephemeral.extendedTextMessage?.text ??
//       ephemeral.imageMessage?.caption ??
//       ephemeral.videoMessage?.caption ??
//       null
//     );
//   }

//   // 3. view-once wrapper
//   const viewOnce = m.viewOnceMessageV2?.message ?? m.viewOnceMessage?.message;
//   if (viewOnce) {
//     return (
//       viewOnce.conversation ??
//       viewOnce.extendedTextMessage?.text ??
//       viewOnce.imageMessage?.caption ??
//       viewOnce.videoMessage?.caption ??
//       null
//     );
//   }

//   return null;
// }

// async function main() {
//   const config = loadConfig();

//   console.log(`[BOT] Default target computer: ${config.defaultComputerId}`);
//   console.log(
//     "[BOT] Commands are only accepted from your own 'Message Yourself' chat."
//   );

//   const hub = new HubClient({
//     hubUrl: config.hubUrl,
//     botId: BOT_ID,
//     commandTimeoutMs: config.commandTimeoutMs,
//   });

//   const wa = await connectWhatsApp();

//   wa.onMessage(async (msg) => {
//     const jid = msg.key.remoteJid;
//     if (!jid) return;

//     const ownJids = wa.getOwnJids();
//     const normalizedJid = jidNormalizedUser(jid);
//     const isSelfChat = msg.key.fromMe === true && ownJids.includes(normalizedJid);

//     // console.log(
//     //   `[BOT][DEBUG] message from=${normalizedJid} fromMe=${msg.key.fromMe} ownJids=${JSON.stringify(ownJids)} accepted=${isSelfChat}`
//     // );

//     if (!isSelfChat) return;

//     // console.log("[BOT] Raw message:", JSON.stringify(msg.message, null, 2));

//     const text = extractText(msg);
//     console.log("[BOT] Extracted text:", text);

//     if (!text) {
//     //   console.log("[BOT] Could not extract text from this message shape");
//       return;
//     }

//     const parsed = parseMessage(text);
//     // console.log("[BOT] Parsed:", parsed);

//     if (parsed.kind === "ignore") return;

//     if (parsed.kind === "help") {
//       await wa.sock.sendMessage(jid, { text: getHelpText() });
//       return;
//     }

//     // parsed.kind === "shell"
//     const { shellCommand, shell } = parsed.intent;

//     if (!hub.isReady()) {
//       await wa.sock.sendMessage(jid, {
//         text: "Not connected to the hub yet — try again in a moment.",
//       });
//       return;
//     }

//     await wa.sock.sendMessage(jid, { text: `Running: ${shellCommand}` });

//     try {
//       const response = await hub.sendShellCommand({
//         computerId: config.defaultComputerId,
//         shellCommand,
//         shell,
//         issuedBy: jid,
//       });

//       if (response.success) {
//         const data = response.data as
//           | { stdout?: string; stderr?: string; exitCode?: number }
//           | undefined;
//         const stdout = data?.stdout?.trim();
//         const stderr = data?.stderr?.trim();

//         let reply = `✅ Exit code ${data?.exitCode ?? 0}`;
//         if (stdout) reply += `\n\n${stdout}`;
//         if (stderr) reply += `\n\n[stderr]\n${stderr}`;

//         await wa.sock.sendMessage(jid, { text: reply });
//       } else {
//         await wa.sock.sendMessage(jid, {
//           text: `❌ ${response.error?.message ?? "Command failed"}`,
//         });
//       }
//     } catch (err) {
//       const message = err instanceof Error ? err.message : "Unknown error";
//       await wa.sock.sendMessage(jid, { text: `❌ ${message}` });
//     }
//   });
// }

// main().catch((err) => {
//   console.error("[BOT] Fatal error during startup:", err);
//   process.exit(1);
// });


//......end

import "dotenv/config";
import { WAMessage, jidNormalizedUser } from "@whiskeysockets/baileys";
import { loadConfig } from "./config.js";
import { parseMessage, getHelpText, isDestructive } from "./commands.js";
import { HubClient } from "./hubClient.js";
import { connectWhatsApp, WhatsAppConnection } from "./whatsapp.js";

const BOT_ID = "whatsapp-bot-01";
const CONFIRMATION_TIMEOUT_MS = 60_000;

interface PendingConfirmation {
  shellCommand: string;
  shell: "cmd" | "powershell";
  timeout: NodeJS.Timeout;
}

function extractText(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;

  const direct = m.conversation ?? m.extendedTextMessage?.text;
  if (direct) return direct;

  const ephemeral = m.ephemeralMessage?.message;
  if (ephemeral) {
    return (
      ephemeral.conversation ??
      ephemeral.extendedTextMessage?.text ??
      ephemeral.imageMessage?.caption ??
      ephemeral.videoMessage?.caption ??
      null
    );
  }

  const viewOnce = m.viewOnceMessageV2?.message ?? m.viewOnceMessage?.message;
  if (viewOnce) {
    return (
      viewOnce.conversation ??
      viewOnce.extendedTextMessage?.text ??
      viewOnce.imageMessage?.caption ??
      viewOnce.videoMessage?.caption ??
      null
    );
  }

  return null;
}

async function runShellCommand(
  jid: string,
  shellCommand: string,
  shell: "cmd" | "powershell",
  wa: WhatsAppConnection,
  hub: HubClient,
  defaultComputerId: string
) {
  await wa.sock.sendMessage(jid, { text: `Running: ${shellCommand}` });

  try {
    const response = await hub.sendShellCommand({
      computerId: defaultComputerId,
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
}

async function main() {
  const config = loadConfig();

  console.log(`[BOT] Default target computer: ${config.defaultComputerId}`);
  console.log(
    "[BOT] Commands are only accepted from your own 'Message Yourself' chat."
  );

  const hub = new HubClient({
    hubUrl: config.hubUrl,
    botId: BOT_ID,
    commandTimeoutMs: config.commandTimeoutMs,
  });

  const wa = await connectWhatsApp();

  const pendingConfirmations = new Map<string, PendingConfirmation>();

  function clearPending(jid: string) {
    const pending = pendingConfirmations.get(jid);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingConfirmations.delete(jid);
    }
  }

  wa.onMessage(async (msg) => {
    const jid = msg.key.remoteJid;
    if (!jid) return;

    const ownJids = wa.getOwnJids();
    const normalizedJid = jidNormalizedUser(jid);
    const isSelfChat = msg.key.fromMe === true && ownJids.includes(normalizedJid);

    if (!isSelfChat) return;

    const text = extractText(msg);
    if (!text) return;

    const parsed = parseMessage(text);

    if (parsed.kind === "ignore") return;

    if (parsed.kind === "help") {
      await wa.sock.sendMessage(jid, { text: getHelpText() });
      return;
    }

    if (parsed.kind === "confirm") {
      const pending = pendingConfirmations.get(normalizedJid);
      if (!pending) {
        await wa.sock.sendMessage(jid, { text: "Nothing pending to confirm." });
        return;
      }
      clearPending(normalizedJid);
      await runShellCommand(
        jid,
        pending.shellCommand,
        pending.shell,
        wa,
        hub,
        config.defaultComputerId
      );
      return;
    }

    if (parsed.kind === "cancel") {
      const pending = pendingConfirmations.get(normalizedJid);
      if (!pending) {
        await wa.sock.sendMessage(jid, { text: "Nothing pending to cancel." });
        return;
      }
      clearPending(normalizedJid);
      await wa.sock.sendMessage(jid, { text: "❎ Cancelled." });
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

    // A new command while one is already pending replaces it
    if (pendingConfirmations.has(normalizedJid)) {
      clearPending(normalizedJid);
    }

    if (isDestructive(shellCommand)) {
      const timeout = setTimeout(() => {
        pendingConfirmations.delete(normalizedJid);
        wa.sock.sendMessage(jid, {
          text: "⌛ Confirmation timed out — command not run.",
        });
      }, CONFIRMATION_TIMEOUT_MS);

      pendingConfirmations.set(normalizedJid, { shellCommand, shell, timeout });

      await wa.sock.sendMessage(jid, {
        text: `⚠️ This looks destructive:\n\`${shellCommand}\`\n\nReply !yes to run or !no to cancel (expires in 60s).`,
      });
      return;
    }

    await runShellCommand(jid, shellCommand, shell, wa, hub, config.defaultComputerId);
  });
}

main().catch((err) => {
  console.error("[BOT] Fatal error during startup:", err);
  process.exit(1);
});