import SysTray, { MenuItem, ClickEvent } from "systray2";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type AgentStatus = "connecting" | "connected" | "disconnected";

// Item order in the menu below: [status, separator, quit]
const STATUS_SEQ_ID = 0;
const QUIT_SEQ_ID = 2;

/**
 * Always-visible tray icon so whoever is at the machine can see the agent
 * is running, see its connection status, and quit it. This is the piece
 * that keeps this a disclosed remote-admin tool rather than a hidden one.
 */
export class AgentTray {
  private systray: SysTray;
  private statusItem: MenuItem;

  constructor(computerId: string, onQuit: () => void) {
    const iconPath = path.join(
      process.cwd(),
      "assets",
      os.platform() === "win32" ? "icon.ico" : "icon.png"
    );

    if (!fs.existsSync(iconPath)) {
      throw new Error(
        `Tray icon not found at ${iconPath}. Add a small square icon there before ` +
          `starting the agent (icon.ico on Windows, icon.png on macOS/Linux).`
      );
    }

    this.statusItem = {
      title: "Status: Connecting...",
      tooltip: `Remote Admin Agent (${computerId})`,
      checked: false,
      enabled: false,
    };

    const quitItem: MenuItem = {
      title: "Quit",
      tooltip: "Disconnect and stop the agent",
      checked: false,
      enabled: true,
    };

    this.systray = new SysTray({
      menu: {
        icon: iconPath,
        title: "",
        tooltip: `Remote Admin Agent (${computerId})`,
        items: [this.statusItem, SysTray.separator, quitItem],
      },
      debug: false,
      copyDir: true,
    });

    this.systray.onClick((action: ClickEvent) => {
      if (action.seq_id === QUIT_SEQ_ID) {
        void this.systray.kill(false);
        onQuit();
      }
    });
  }

  public async start() {
    await this.systray.ready();
  }

  public setStatus(status: AgentStatus, detail?: string) {
    const labels: Record<AgentStatus, string> = {
      connecting: "Status: Connecting...",
      connected: `Status: Connected${detail ? ` — ${detail}` : ""}`,
      disconnected: "Status: Disconnected (retrying...)",
    };

    this.statusItem = { ...this.statusItem, title: labels[status] };

    void this.systray.sendAction({
      type: "update-item",
      item: this.statusItem,
      seq_id: STATUS_SEQ_ID,
    });
  }
}