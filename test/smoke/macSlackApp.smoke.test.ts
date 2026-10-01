// ABOUTME: Runs the SlackApp contract, and checks how Slack's exit is detected, against the real Slack app.
// ABOUTME: Restarts Slack several times, so it runs only with HACKSLACK_SMOKE=1 (`just smoke`).
import { describe, expect, test } from "bun:test";
import type { SlackPage } from "../../src/core/ports";
import { CdpSlackApp } from "../../src/slack/cdpSlackApp";
import { quitRunningSlack, runningSlackPids, waitUntil } from "../../src/slack/macProcesses";
import { MacSlackProcess } from "../../src/slack/macSlackProcess";
import { slackAppContract } from "../contract/slackAppContract";
import { deferred, withTimeout } from "../helpers";

const log = (message: string) => console.log(`[smoke] ${message}`);
const makeApp = () => new CdpSlackApp(new MacSlackProcess(log), log);

async function launchNormal() {
  const app = makeApp();
  const ready = deferred<SlackPage>();
  const exited = deferred<string>();
  const info = await app.launch("normal", {
    pageReady: (page) => ready.resolve(page),
    pageGone: () => {},
    exited: (reason) => exited.resolve(reason),
  });
  await withTimeout(ready.promise, 30_000, "pageReady");
  return { app, info, exited: exited.promise };
}

describe.skipIf(process.env.HACKSLACK_SMOKE !== "1")("real Slack", () => {
  slackAppContract("CdpSlackApp on macOS", makeApp, 30_000);

  test("Normal mode: the Slack process exits after close()", async () => {
    const { app, info } = await launchNormal();
    await app.close();
    expect(await waitUntil(() => !runningSlackPids().includes(info.slackPid), 10_000)).toBe(true);
  }, 60_000);

  test("Normal mode: quitting Slack is reported as the pipe closing", async () => {
    const { exited } = await launchNormal();
    await quitRunningSlack(log);
    expect(await withTimeout(exited, 15_000, "exited")).toBe("pipe closed by Slack");
  }, 60_000);
});
