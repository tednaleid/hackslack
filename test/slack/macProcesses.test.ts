// ABOUTME: Tests for the macOS process helpers that can run without Slack.
// ABOUTME: Covers port selection, polling and checking the debugger URL.
import { expect, test } from "bun:test";
import { pickFreePort, waitForDebuggerUrl, waitUntil } from "../../src/slack/macProcesses";

test("pickFreePort returns a port that can be listened on", async () => {
  const port = await pickFreePort();
  expect(port).toBeGreaterThan(1023);
  const server = Bun.serve({ port, hostname: "127.0.0.1", fetch: () => new Response("ok") });
  expect(server.port).toBe(port);
  server.stop(true);
});

test("waitUntil reports whether the condition held before the timeout", async () => {
  let calls = 0;
  expect(await waitUntil(() => ++calls >= 3, 1000, 5)).toBe(true);
  expect(await waitUntil(() => false, 30, 5)).toBe(false);
});

function serveDebuggerUrl(url: (port: number) => string) {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () => Response.json({ webSocketDebuggerUrl: url(server.port!) }),
  });
  return server;
}

test("waitForDebuggerUrl returns a WebSocket URL on the same loopback port", async () => {
  const server = serveDebuggerUrl((port) => `ws://127.0.0.1:${port}/devtools/browser/abc`);
  try {
    expect(await waitForDebuggerUrl(server.port!, 1000)).toBe(`ws://127.0.0.1:${server.port}/devtools/browser/abc`);
  } finally {
    server.stop(true);
  }
});

test("waitForDebuggerUrl rejects a URL that points anywhere else", async () => {
  const server = serveDebuggerUrl(() => "ws://evil.example:9222/devtools/browser/abc");
  try {
    await expect(waitForDebuggerUrl(server.port!, 1000)).rejects.toThrow("unexpected debugger URL");
  } finally {
    server.stop(true);
  }
});
