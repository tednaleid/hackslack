// ABOUTME: Finds Slack pages over CDP, attaches to each once, and applies CSS that survives reloads.
// ABOUTME: Uses only the Target, Page and Runtime domains; CSS changes for one page are applied in call order.
import type { CdpClient } from "../cdp/cdpClient";
import { buildInjectionSource, READ_APPLIED_CSS } from "../cdp/injection";
import { errorMessage, type Log, shortId } from "../core/log";
import type { SlackAppEvents } from "../core/ports";

export const SLACK_PAGE_URL = /^https:\/\/app\.slack\.com\//;

interface TargetInfo {
  targetId: string;
  type: string;
  url: string;
}

export class CdpSlackSession {
  private readonly sessions = new Map<string, string>();
  private readonly attaching = new Set<string>();
  private readonly destroyedWhileAttaching = new Set<string>();
  private readonly scripts = new Map<string, string>();
  private readonly queues = new Map<string, Promise<void>>();

  constructor(
    private readonly cdp: CdpClient,
    private readonly events: SlackAppEvents,
    private readonly log: Log,
  ) {}

  async start(): Promise<void> {
    this.cdp.on("Target.targetCreated", (params) => this.consider(params.targetInfo));
    this.cdp.on("Target.targetInfoChanged", (params) => this.consider(params.targetInfo));
    this.cdp.on("Target.targetDestroyed", (params) => this.forget(params.targetId));
    this.cdp.on("Target.detachedFromTarget", (params) => this.forget(params.targetId));
    this.cdp.onClose((reason) => this.events.exited(reason));
    await this.cdp.send("Target.setDiscoverTargets", { discover: true });
  }

  applyCss(pageId: string, css: string): Promise<void> {
    const previous = this.queues.get(pageId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(() => this.replaceCss(pageId, css));
    this.queues.set(pageId, next);
    return next;
  }

  async readAppliedCss(pageId: string): Promise<string | null> {
    const value = await this.evaluate(this.sessionFor(pageId), READ_APPLIED_CSS);
    return typeof value === "string" ? value : null;
  }

  private consider(info: TargetInfo): void {
    if (info.type !== "page" || !SLACK_PAGE_URL.test(info.url)) return;
    if (this.sessions.has(info.targetId) || this.attaching.has(info.targetId)) return;
    this.attaching.add(info.targetId);
    void this.attach(info).finally(() => {
      this.attaching.delete(info.targetId);
      this.destroyedWhileAttaching.delete(info.targetId);
    });
  }

  private async attach(info: TargetInfo): Promise<void> {
    try {
      const { sessionId } = await this.cdp.send("Target.attachToTarget", { targetId: info.targetId, flatten: true });
      await this.cdp.send("Page.enable", {}, sessionId);
      if (this.destroyedWhileAttaching.has(info.targetId)) return;
      this.sessions.set(info.targetId, sessionId);
      this.log(`attached to Slack page ${shortId(info.targetId)}`);
      this.events.pageReady({ id: info.targetId, url: info.url });
    } catch (error) {
      this.log(`could not attach to page ${shortId(info.targetId)}: ${errorMessage(error)}`);
    }
  }

  private forget(targetId: string): void {
    if (this.attaching.has(targetId)) this.destroyedWhileAttaching.add(targetId);
    this.scripts.delete(targetId);
    this.queues.delete(targetId);
    if (this.sessions.delete(targetId)) this.events.pageGone(targetId);
  }

  private async replaceCss(pageId: string, css: string): Promise<void> {
    const sessionId = this.sessionFor(pageId);
    const source = buildInjectionSource(css);
    const previous = this.scripts.get(pageId);
    const { identifier } = await this.cdp.send("Page.addScriptToEvaluateOnNewDocument", { source }, sessionId);
    this.scripts.set(pageId, identifier);
    if (previous) await this.cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: previous }, sessionId);
    await this.evaluate(sessionId, source);
  }

  private async evaluate(sessionId: string, expression: string): Promise<unknown> {
    const response = await this.cdp.send("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
    if (response.exceptionDetails) throw new Error(`evaluation failed: ${response.exceptionDetails.text}`);
    return response.result?.value;
  }

  private sessionFor(pageId: string): string {
    const sessionId = this.sessions.get(pageId);
    if (!sessionId) throw new Error(`no attached Slack page ${shortId(pageId)}`);
    return sessionId;
  }
}
