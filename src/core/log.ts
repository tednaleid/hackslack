// ABOUTME: Logging type and small helpers for describing errors and ids in log lines.
// ABOUTME: Log lines must never include Slack message content.

export type Log = (message: string) => void;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}
