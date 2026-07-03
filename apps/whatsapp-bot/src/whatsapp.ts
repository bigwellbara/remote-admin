// import makeWASocket, {
//   DisconnectReason,
//   useMultiFileAuthState,
//   WASocket,
//   WAMessage,
// } from "@whiskeysockets/baileys";
// import { Boom } from "@hapi/boom";
// import qrcodeTerminal from "qrcode-terminal";
// import path from "node:path";
// import pino from "pino";

// const AUTH_DIR = path.join(process.cwd(), "auth");
// const logger = pino({ level: "silent" });

// export interface WhatsAppConnection {
//   sock: WASocket;
//   onMessage: (handler: (msg: WAMessage) => void) => void;
// }

// /**
//  * Connects to WhatsApp via Baileys, persisting session credentials to
//  * ./auth so a QR scan is only needed once. Auto-reconnects unless the
//  * session was explicitly logged out from the phone.
//  */
// export async function connectWhatsApp(): Promise<WhatsAppConnection> {
//   const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

//   let messageHandler: ((msg: WAMessage) => void) | null = null;
//   let currentSock: WASocket;

//   function start(): WASocket {
//     const sock = makeWASocket({
//       auth: state,
//       logger,
//     });

//     sock.ev.on("creds.update", saveCreds);

//     sock.ev.on("connection.update", (update) => {
//       const { connection, lastDisconnect, qr } = update;

//       if (qr) {
//         console.log("[BOT] Scan this QR code with WhatsApp (Linked Devices):");
//         qrcodeTerminal.generate(qr, { small: true });
//       }

//       if (connection === "close") {
//         const statusCode = (lastDisconnect?.error as Boom | undefined)?.output
//           ?.statusCode;
//         const loggedOut = statusCode === DisconnectReason.loggedOut;

//         console.log(
//           `[BOT] WhatsApp connection closed (${statusCode ?? "unknown"}). ` +
//             (loggedOut ? "Logged out — delete ./auth and re-scan." : "Reconnecting...")
//         );

//         if (!loggedOut) {
//           currentSock = start();
//         }
//       } else if (connection === "open") {
//         console.log("[BOT] WhatsApp connected");
//       }
//     });

//     sock.ev.on("messages.upsert", ({ messages, type }) => {
//       if (type !== "notify") return;
//       for (const msg of messages) {
//         if (messageHandler) messageHandler(msg);
//       }
//     });

//     return sock;
//   }

//   currentSock = start();

//   return {
//     get sock() {
//       return currentSock;
//     },
//     onMessage(handler) {
//       messageHandler = handler;
//     },
//   } as WhatsAppConnection;
// }


import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  jidNormalizedUser,
  WASocket,
  WAMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcodeTerminal from "qrcode-terminal";
import path from "node:path";
import pino from "pino";

const AUTH_DIR = path.join(process.cwd(), "auth");
const logger = pino({ level: "silent" });

export interface WhatsAppConnection {
  sock: WASocket;
  onMessage: (handler: (msg: WAMessage) => void) => void;
  /**
   * All JIDs that represent "you" — WhatsApp's newer privacy system splits
   * your identity across a phone-number JID (...@s.whatsapp.net) and a
   * separate LID (...@lid), and self-chat messages can arrive tagged with
   * either depending on account/session state. Compare against all of them.
   */
  getOwnJids: () => string[];
}

/**
 * Connects to WhatsApp via Baileys, persisting session credentials to
 * ./auth so a QR scan is only needed once. Auto-reconnects unless the
 * session was explicitly logged out from the phone.
 */
export async function connectWhatsApp(): Promise<WhatsAppConnection> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  let messageHandler: ((msg: WAMessage) => void) | null = null;
  let currentSock: WASocket;

  function start(): WASocket {
    const sock = makeWASocket({
      auth: state,
      logger,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("[BOT] Scan this QR code with WhatsApp (Linked Devices):");
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output
          ?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(
          `[BOT] WhatsApp connection closed (${statusCode ?? "unknown"}). ` +
            (loggedOut ? "Logged out — delete ./auth and re-scan." : "Reconnecting...")
        );

        if (!loggedOut) {
          currentSock = start();
        }
      } else if (connection === "open") {
        console.log("[BOT] WhatsApp connected");
      }
    });

    sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (messageHandler) messageHandler(msg);
      }
    });

    return sock;
  }

  currentSock = start();

  return {
    get sock() {
      return currentSock;
    },
    onMessage(handler) {
      messageHandler = handler;
    },
    getOwnJids() {
      const user = currentSock.user;
      if (!user) return [];

      const candidates = [user.id, user.lid].filter(
        (v): v is string => typeof v === "string" && v.length > 0
      );

      return candidates.map((jid) => jidNormalizedUser(jid));
    },
  } as WhatsAppConnection;
}