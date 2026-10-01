// ABOUTME: Minimal Chrome DevTools Protocol client over a Transport.
// ABOUTME: Matches responses to requests by id, routes events by method, and carries sessionIds.
import type { Transport } from "./transport";

export class CdpError extends Error {}

type EventHandler = (params: any, sessionId: string | undefined) => void;

interface Pending {
  method: string;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export class CdpClient {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly handlers = new Map<string, EventHandler[]>();
  private readonly closeHandlers: ((reason: string) => void)[] = [];
  private closedReason: string | null = null;

  constructor(private readonly transport: Transport) {
    transport.onMessage((message) => this.receive(message));
    transport.onClose((reason) => this.handleClose(reason));
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<any> {
    if (this.closedReason !== null) {
      return Promise.reject(new CdpError(`${method}: connection closed (${this.closedReason})`));
    }
    const id = this.nextId++;
    const message: Record<string, unknown> = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.transport.send(JSON.stringify(message));
    });
  }

  on(method: string, handler: EventHandler): void {
    this.handlers.set(method, [...(this.handlers.get(method) ?? []), handler]);
  }

  onClose(handler: (reason: string) => void): void {
    this.closeHandlers.push(handler);
  }

  close(): void {
    this.transport.close();
    this.handleClose("closed by launcher");
  }

  private receive(raw: string): void {
    let message: any;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof message.id === "number") {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new CdpError(`${entry.method}: ${message.error.message}`));
      else entry.resolve(message.result ?? {});
      return;
    }
    if (typeof message.method === "string") {
      for (const handler of this.handlers.get(message.method) ?? []) {
        handler(message.params ?? {}, message.sessionId);
      }
    }
  }

  private handleClose(reason: string): void {
    if (this.closedReason !== null) return;
    this.closedReason = reason;
    for (const entry of this.pending.values()) {
      entry.reject(new CdpError(`${entry.method}: connection closed (${reason})`));
    }
    this.pending.clear();
    for (const handler of this.closeHandlers) handler(reason);
  }
}
