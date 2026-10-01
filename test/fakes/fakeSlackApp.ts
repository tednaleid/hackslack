// ABOUTME: In-memory SlackApp for testing the core without Slack.
// ABOUTME: Tests add and remove pages, make injection fail, and end Slack on demand.
import type { LaunchInfo, Mode, SlackApp, SlackAppEvents, SlackPage } from "../../src/core/ports";

export const FAKE_PAGE: SlackPage = { id: "page-1", url: "https://app.slack.com/client/T0000001" };

export class FakeSlackApp implements SlackApp {
  launchedMode: Mode | null = null;
  launchError: Error | null = null;
  readonly applied = new Map<string, string>();
  readonly failApplyFor = new Set<string>();
  private readonly pages = new Set<string>();
  private events: SlackAppEvents | null = null;

  async launch(mode: Mode, events: SlackAppEvents): Promise<LaunchInfo> {
    if (this.launchError) throw this.launchError;
    this.launchedMode = mode;
    this.events = events;
    queueMicrotask(() => this.addPage(FAKE_PAGE));
    return { slackPid: 4242, port: mode === "inspect" ? 9555 : null };
  }

  async applyCss(pageId: string, css: string): Promise<void> {
    if (!this.pages.has(pageId)) throw new Error(`no attached Slack page ${pageId}`);
    if (this.failApplyFor.has(pageId)) throw new Error(`injection failed for ${pageId}`);
    this.applied.set(pageId, css);
  }

  async readAppliedCss(pageId: string): Promise<string | null> {
    return this.applied.get(pageId) ?? null;
  }

  async close(): Promise<void> {
    if (this.launchedMode === "normal") this.events?.exited("closed by launcher");
  }

  addPage(page: SlackPage): void {
    this.pages.add(page.id);
    this.events!.pageReady(page);
  }

  removePage(pageId: string): void {
    this.pages.delete(pageId);
    this.applied.delete(pageId);
    this.events!.pageGone(pageId);
  }

  exit(reason: string): void {
    this.events!.exited(reason);
  }
}
