// ABOUTME: The core: keeps the combined Stylesheets applied to every Slack page.
// ABOUTME: Applies on page ready, re-applies to all pages when the Stylesheets change, and reports stats.
import { errorMessage, type Log, shortId } from "./log";
import type { LaunchInfo, Mode, SlackApp, Stylesheets } from "./ports";

export interface KeeperStats {
  injectCount: number;
  lastInjectAt: string | null;
  pageCount: number;
}

export class StyleKeeper {
  readonly exited: Promise<string>;
  private resolveExited!: (reason: string) => void;
  private readonly pages = new Set<string>();
  private css = "";
  private injectCount = 0;
  private lastInjectAt: string | null = null;
  private stopWatching: () => void = () => {};
  private reloads: Promise<void> = Promise.resolve();

  constructor(
    private readonly slack: SlackApp,
    private readonly stylesheets: Stylesheets,
    private readonly log: Log,
    private readonly onStats: (stats: KeeperStats) => void = () => {},
  ) {
    this.exited = new Promise((resolve) => {
      this.resolveExited = resolve;
    });
  }

  async start(mode: Mode): Promise<LaunchInfo> {
    this.css = await this.stylesheets.load();
    this.stopWatching = this.stylesheets.watch(() => {
      this.reloads = this.reloads.then(() => this.reload());
    });
    try {
      return await this.slack.launch(mode, {
        pageReady: (page) => {
          this.pages.add(page.id);
          void this.apply(page.id);
        },
        pageGone: (pageId) => {
          this.pages.delete(pageId);
          this.publish();
        },
        exited: (reason) => {
          this.stopWatching();
          this.resolveExited(reason);
        },
      });
    } catch (error) {
      this.stopWatching();
      throw error;
    }
  }

  private async reload(): Promise<void> {
    try {
      this.css = await this.stylesheets.load();
    } catch (error) {
      this.log(`could not reload Stylesheets, keeping the previous CSS: ${errorMessage(error)}`);
      return;
    }
    this.log(`Stylesheets changed; applying to ${this.pages.size} page(s)`);
    await Promise.all([...this.pages].map((pageId) => this.apply(pageId)));
  }

  private async apply(pageId: string): Promise<void> {
    try {
      await this.slack.applyCss(pageId, this.css);
      this.injectCount++;
      this.lastInjectAt = new Date().toISOString();
      this.log(`applied Stylesheets to page ${shortId(pageId)}`);
    } catch (error) {
      this.log(`could not apply Stylesheets to page ${shortId(pageId)}: ${errorMessage(error)}`);
    }
    this.publish();
  }

  private publish(): void {
    this.onStats({ injectCount: this.injectCount, lastInjectAt: this.lastInjectAt, pageCount: this.pages.size });
  }
}
