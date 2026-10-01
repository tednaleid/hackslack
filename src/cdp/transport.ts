// ABOUTME: The byte-agnostic message channel the CDP client talks over.
// ABOUTME: Implemented by the debugging pipe, a WebSocket, and an in-memory pair in tests.

export interface Transport {
  send(message: string): void;
  onMessage(handler: (message: string) => void): void;
  onClose(handler: (reason: string) => void): void;
  close(): void;
}
