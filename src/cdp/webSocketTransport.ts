// ABOUTME: Transport over a WebSocket to Slack's debugging port, used only in Inspect mode.
// ABOUTME: Uses Bun's built-in WebSocket client; the URL always points at 127.0.0.1.
import type { Transport } from "./transport";

export function webSocketTransport(url: string): Promise<Transport> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    let onMessage = (_message: string) => {};
    let onClose = (_reason: string) => {};
    let opened = false;

    socket.onopen = () => {
      opened = true;
      resolve({
        send: (message) => socket.send(message),
        onMessage: (handler) => {
          onMessage = handler;
        },
        onClose: (handler) => {
          onClose = handler;
        },
        close: () => socket.close(),
      });
    };
    socket.onmessage = (event) => onMessage(String(event.data));
    socket.onerror = () => {
      if (!opened) reject(new Error(`could not open a WebSocket to ${url}`));
    };
    socket.onclose = (event) => {
      if (opened) onClose(`websocket closed (code ${event.code})`);
      else reject(new Error(`WebSocket to ${url} closed before opening (code ${event.code})`));
    };
  });
}
