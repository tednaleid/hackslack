// ABOUTME: Scripted stand-in for Chromium's DevTools endpoint, speaking CDP over an in-memory Transport.
// ABOUTME: Tracks targets, sessions, new-document scripts and a FakeDocument for each attached page.
import type { Transport } from "../../src/cdp/transport";
import type { Mode } from "../../src/core/ports";
import type { SlackConnection, SlackProcess } from "../../src/slack/cdpSlackApp";
import { evaluateIn, FakeDocument } from "./fakeDocument";
import { memoryTransportPair } from "./memoryTransport";

export interface FakeTarget {
  targetId: string;
  type: string;
  url: string;
}

export const SLACK_TARGET: FakeTarget = {
  targetId: "PAGE-0001",
  type: "page",
  url: "https://app.slack.com/client/T0000001",
};

interface Request {
  id: number;
  method: string;
  params?: any;
  sessionId?: string;
}

export class FakeChromium {
  readonly clientTransport: Transport;
  readonly documents = new Map<string, FakeDocument>();
  readonly newDocumentScripts = new Map<string, Map<string, string>>();
  readonly failNext = new Set<string>();
  destroyOnPageEnable = false;
  private readonly peer: Transport;
  private readonly received: string[] = [];
  private readonly sessionTargets = new Map<string, string>();
  private nextScriptId = 1;

  constructor(private readonly targets: FakeTarget[] = [SLACK_TARGET]) {
    const [client, peer] = memoryTransportPair();
    this.clientTransport = client;
    this.peer = peer;
    peer.onMessage((raw) => this.handle(JSON.parse(raw)));
  }

  callsTo(method: string): number {
    return this.received.filter((received) => received === method).length;
  }

  changeTarget(target: FakeTarget): void {
    this.emit("Target.targetInfoChanged", { targetInfo: target });
  }

  destroyTarget(targetId: string): void {
    for (const [sessionId, id] of this.sessionTargets) if (id === targetId) this.sessionTargets.delete(sessionId);
    this.emit("Target.targetDestroyed", { targetId });
  }

  reloadPage(targetId: string): void {
    const doc = new FakeDocument({ parsed: false });
    this.documents.set(targetId, doc);
    for (const source of this.newDocumentScripts.get(targetId)?.values() ?? []) evaluateIn(doc, source);
    doc.finishParsing();
  }

  disconnect(): void {
    this.peer.close();
  }

  private emit(method: string, params: object): void {
    this.peer.send(JSON.stringify({ method, params }));
  }

  private handle(request: Request): void {
    this.received.push(request.method);
    const params = request.params ?? {};
    const reply = (result: object) => this.peer.send(JSON.stringify({ id: request.id, result }));
    const fail = (message: string) => this.peer.send(JSON.stringify({ id: request.id, error: { code: -32000, message } }));
    const targetId = request.sessionId ? this.sessionTargets.get(request.sessionId) : undefined;
    if (request.sessionId && !targetId) return fail(`Session with given id not found: ${request.sessionId}`);
    if (this.failNext.delete(request.method)) return fail(`${request.method} failed as the test asked`);

    switch (request.method) {
      case "Target.setDiscoverTargets":
        reply({});
        for (const targetInfo of this.targets) this.emit("Target.targetCreated", { targetInfo });
        return;
      case "Target.attachToTarget": {
        const sessionId = `SESSION-${params.targetId}`;
        this.sessionTargets.set(sessionId, params.targetId);
        this.documents.set(params.targetId, new FakeDocument());
        this.newDocumentScripts.set(params.targetId, new Map());
        return reply({ sessionId });
      }
      case "Page.enable":
        reply({});
        if (this.destroyOnPageEnable) this.destroyTarget(targetId!);
        return;
      case "Page.addScriptToEvaluateOnNewDocument": {
        const identifier = String(this.nextScriptId++);
        this.newDocumentScripts.get(targetId!)!.set(identifier, params.source);
        return reply({ identifier });
      }
      case "Page.removeScriptToEvaluateOnNewDocument":
        if (!this.newDocumentScripts.get(targetId!)!.delete(params.identifier)) return fail("Script not found");
        return reply({});
      case "Runtime.evaluate":
        try {
          return reply({ result: { value: evaluateIn(this.documents.get(targetId!)!, params.expression) } });
        } catch (error) {
          return reply({ result: { type: "object" }, exceptionDetails: { text: String(error) } });
        }
      default:
        return fail(`FakeChromium does not handle ${request.method}`);
    }
  }
}

export class FakeChromiumProcess implements SlackProcess {
  chromium: FakeChromium | null = null;

  async start(mode: Mode): Promise<SlackConnection> {
    this.chromium = new FakeChromium();
    return { transport: this.chromium.clientTransport, slackPid: 31337, port: mode === "inspect" ? 9555 : null };
  }
}
