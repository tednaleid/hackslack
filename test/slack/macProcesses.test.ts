// ABOUTME: Tests for the macOS process helpers that can run without Slack.
// ABOUTME: Covers port selection, polling and process liveness.
import { expect, test } from "bun:test";
import { isProcessAlive, pickFreePort, waitUntil } from "../../src/slack/macProcesses";

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

test("isProcessAlive is true for this process and false for an unused pid", () => {
  expect(isProcessAlive(process.pid)).toBe(true);
  expect(isProcessAlive(999_999)).toBe(false);
});
