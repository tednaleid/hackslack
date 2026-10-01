// ABOUTME: Tests for CdpClient: matching responses to requests, events, sessions and closing.
// ABOUTME: Uses an in-memory transport whose far end plays Chromium by hand.
import { expect, test } from "bun:test";
import { CdpClient } from "../../src/cdp/cdpClient";
import { memoryTransportPair } from "../fakes/memoryTransport";
import { eventually } from "../helpers";

function connectedClient() {
  const [clientSide, peer] = memoryTransportPair();
  const sent: any[] = [];
  peer.onMessage((message) => sent.push(JSON.parse(message)));
  const reply = (message: object) => peer.send(JSON.stringify(message));
  return { client: new CdpClient(clientSide), sent, reply, peer };
}

test("resolves each response with the result for its own id, in any order", async () => {
  const { client, sent, reply } = connectedClient();
  const first = client.send("Target.getTargets");
  const second = client.send("Browser.getVersion");
  await eventually(() => sent.length === 2);
  expect(sent.map((m) => m.method)).toEqual(["Target.getTargets", "Browser.getVersion"]);
  reply({ id: sent[1].id, result: { product: "Chrome" } });
  reply({ id: sent[0].id, result: { targetInfos: [] } });
  expect(await second).toEqual({ product: "Chrome" });
  expect(await first).toEqual({ targetInfos: [] });
});

test("includes sessionId only when one is given", async () => {
  const { client, sent } = connectedClient();
  void client.send("Target.setDiscoverTargets", { discover: true });
  void client.send("Page.enable", {}, "SESSION-1");
  await eventually(() => sent.length === 2);
  expect("sessionId" in sent[0]).toBe(false);
  expect(sent[0].params).toEqual({ discover: true });
  expect(sent[1].sessionId).toBe("SESSION-1");
});

test("rejects with the method name and the CDP error message", async () => {
  const { client, sent, reply } = connectedClient();
  const attach = client.send("Target.attachToTarget", { targetId: "nope" });
  await eventually(() => sent.length === 1);
  reply({ id: sent[0].id, error: { code: -32000, message: "No target with given id found" } });
  await expect(attach).rejects.toThrow("Target.attachToTarget: No target with given id found");
});

test("delivers events with their sessionId to every handler for that method", async () => {
  const { client, reply } = connectedClient();
  const seen: string[] = [];
  client.on("Page.loadEventFired", (_params, sessionId) => seen.push(`a:${sessionId}`));
  client.on("Page.loadEventFired", (_params, sessionId) => seen.push(`b:${sessionId}`));
  reply({ method: "Page.loadEventFired", params: { timestamp: 1 }, sessionId: "SESSION-1" });
  await eventually(() => seen.length === 2);
  expect(seen).toEqual(["a:SESSION-1", "b:SESSION-1"]);
});

test("rejects pending and later requests once the connection closes, and reports why", async () => {
  const { client, peer } = connectedClient();
  const reasons: string[] = [];
  client.onClose((reason) => reasons.push(reason));
  const pending = client.send("Page.enable");
  peer.close();
  await expect(pending).rejects.toThrow("Page.enable: connection closed (closed)");
  expect(reasons).toEqual(["closed"]);
  await expect(client.send("Page.enable")).rejects.toThrow("connection closed");
});

test("close() reports the reason once", async () => {
  const { client } = connectedClient();
  const reasons: string[] = [];
  client.onClose((reason) => reasons.push(reason));
  client.close();
  await Bun.sleep(5);
  expect(reasons).toEqual(["closed by launcher"]);
});

test("ignores messages that are not valid JSON", async () => {
  const { client, sent, reply, peer } = connectedClient();
  const request = client.send("Browser.getVersion");
  await eventually(() => sent.length === 1);
  peer.send("not json");
  reply({ id: sent[0].id, result: { ok: true } });
  expect(await request).toEqual({ ok: true });
});
