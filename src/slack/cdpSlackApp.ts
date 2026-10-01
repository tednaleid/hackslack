// ABOUTME: The SlackApp adapter: starts Slack through a SlackProcess and drives it over CDP.
// ABOUTME: SlackProcess hides how Slack is started (macOS in production, FakeChromium in tests).
import { CdpClient } from "../cdp/cdpClient";
import type { Transport } from "../cdp/transport";
import type { Log } from "../core/log";
import type { LaunchInfo, Mode, SlackApp, SlackAppEvents } from "../core/ports";
import { CdpSlackSession } from "./cdpSlackSession";

export interface SlackConnection {
  transport: Transport;
  slackPid: number;
  port: number | null;
}

export interface SlackProcess {
  start(mode: Mode): Promise<SlackConnection>;
}

export class CdpSlackApp implements SlackApp {
  private cdp: CdpClient | null = null;
  private session: CdpSlackSession | null = null;

  constructor(
    private readonly slackProcess: SlackProcess,
    private readonly log: Log,
  ) {}

  async launch(mode: Mode, events: SlackAppEvents): Promise<LaunchInfo> {
    const connection = await this.slackProcess.start(mode);
    this.cdp = new CdpClient(connection.transport);
    this.session = new CdpSlackSession(this.cdp, events, this.log);
    await this.session.start();
    return { slackPid: connection.slackPid, port: connection.port };
  }

  applyCss(pageId: string, css: string): Promise<void> {
    return this.requireSession().applyCss(pageId, css);
  }

  readAppliedCss(pageId: string): Promise<string | null> {
    return this.requireSession().readAppliedCss(pageId);
  }

  async close(): Promise<void> {
    this.cdp?.close();
  }

  private requireSession(): CdpSlackSession {
    if (!this.session) throw new Error("Slack has not been launched");
    return this.session;
  }
}
