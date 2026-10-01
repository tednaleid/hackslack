// ABOUTME: Tests for CdpSlackSession: finding Slack pages, attaching once, and applying CSS that survives reloads.
// ABOUTME: Runs against FakeChromium over an in-memory transport.
import { expect, test } from "bun:test";
import { CdpClient } from "../../src/cdp/cdpClient";
import { READ_APPLIED_CSS } from "../../src/cdp/injection";
import type { SlackPage } from "../../src/core/ports";
import { CdpSlackSession } from "../../src/slack/cdpSlackSession";
import { FakeChromium, type FakeTarget, SLACK_TARGET } from "../fakes/fakeChromium";
import { evaluateIn } from "../fakes/fakeDocument";
import { eventually } from "../helpers";

async function startSession(targets?: FakeTarget[]) {
  const chromium = new FakeChromium(targets);
  const ready: SlackPage[] = [];
  const gone: string[] = [];
  const exits: string[] = [];
  const session = new CdpSlackSession(
    new CdpClient(chromium.clientTransport),
    { pageReady: (page) => ready.push(page), pageGone: (id) => gone.push(id), exited: (reason) => exits.push(reason) },
    () => {},
  );
  await session.start();
  return { chromium, session, ready, gone, exits };
}

function appliedCss(chromium: FakeChromium, targetId: string): unknown {
  return evaluateIn(chromium.documents.get(targetId)!, READ_APPLIED_CSS);
}

test("attaches to Slack pages only and reports them ready", async () => {
  const { chromium, ready } = await startSession([
    SLACK_TARGET,
    { targetId: "SW-1", type: "service_worker", url: "https://app.slack.com/service-worker.js" },
    { targetId: "PAGE-OTHER", type: "page", url: "https://example.com/" },
  ]);
  await eventually(() => ready.length === 1);
  expect(ready).toEqual([{ id: SLACK_TARGET.targetId, url: SLACK_TARGET.url }]);
  await Bun.sleep(10);
  expect(chromium.callsTo("Target.attachToTarget")).toBe(1);
});

test("attaches once when a page's URL arrives after it was created", async () => {
  const blank = { ...SLACK_TARGET, url: "" };
  const { chromium, ready } = await startSession([blank]);
  await Bun.sleep(10);
  expect(ready).toEqual([]);
  chromium.changeTarget(SLACK_TARGET);
  chromium.changeTarget(SLACK_TARGET);
  chromium.changeTarget(SLACK_TARGET);
  await eventually(() => ready.length === 1);
  await Bun.sleep(10);
  expect(ready).toHaveLength(1);
  expect(chromium.callsTo("Target.attachToTarget")).toBe(1);
});

test("applies CSS to the current document and to documents after a reload", async () => {
  const { chromium, session, ready } = await startSession();
  await eventually(() => ready.length === 1);
  await session.applyCss(SLACK_TARGET.targetId, ".a { display: none }");
  expect(appliedCss(chromium, SLACK_TARGET.targetId)).toBe(".a { display: none }");
  chromium.reloadPage(SLACK_TARGET.targetId);
  expect(appliedCss(chromium, SLACK_TARGET.targetId)).toBe(".a { display: none }");
});

test("replacing CSS leaves one new-document script with the latest CSS", async () => {
  const { chromium, session, ready } = await startSession();
  await eventually(() => ready.length === 1);
  await Promise.all([
    session.applyCss(SLACK_TARGET.targetId, ".a {}"),
    session.applyCss(SLACK_TARGET.targetId, ".b {}"),
    session.applyCss(SLACK_TARGET.targetId, ".c {}"),
  ]);
  expect(chromium.newDocumentScripts.get(SLACK_TARGET.targetId)!.size).toBe(1);
  chromium.reloadPage(SLACK_TARGET.targetId);
  expect(appliedCss(chromium, SLACK_TARGET.targetId)).toBe(".c {}");
});

test("reads null before any CSS is applied, then the applied CSS", async () => {
  const { session, ready } = await startSession();
  await eventually(() => ready.length === 1);
  expect(await session.readAppliedCss(SLACK_TARGET.targetId)).toBeNull();
  await session.applyCss(SLACK_TARGET.targetId, ".a {}");
  expect(await session.readAppliedCss(SLACK_TARGET.targetId)).toBe(".a {}");
});

test("reports a destroyed page as gone and refuses to style it", async () => {
  const { chromium, session, ready, gone } = await startSession();
  await eventually(() => ready.length === 1);
  chromium.destroyTarget(SLACK_TARGET.targetId);
  await eventually(() => gone.length === 1);
  expect(gone).toEqual([SLACK_TARGET.targetId]);
  await expect(session.applyCss(SLACK_TARGET.targetId, ".a {}")).rejects.toThrow("no attached Slack page");
});

test("reports Slack exiting when the connection closes", async () => {
  const { chromium, exits } = await startSession();
  chromium.disconnect();
  await eventually(() => exits.length === 1);
  expect(exits).toEqual(["closed"]);
});
