// ABOUTME: In-memory pair of connected Transports for tests.
// ABOUTME: Messages are delivered asynchronously, as they would be over a real pipe or socket.
import type { Transport } from "../../src/cdp/transport";

export function memoryTransportPair(): [Transport, Transport] {
  const handlers = [
    { message: (_message: string) => {}, close: (_reason: string) => {} },
    { message: (_message: string) => {}, close: (_reason: string) => {} },
  ];
  let closed = false;
  const side = (self: number, other: number): Transport => ({
    send: (message) => {
      if (!closed) queueMicrotask(() => handlers[other]!.message(message));
    },
    onMessage: (handler) => {
      handlers[self]!.message = handler;
    },
    onClose: (handler) => {
      handlers[self]!.close = handler;
    },
    close: () => {
      if (closed) return;
      closed = true;
      queueMicrotask(() => {
        handlers[0]!.close("closed");
        handlers[1]!.close("closed");
      });
    },
  });
  return [side(0, 1), side(1, 0)];
}
