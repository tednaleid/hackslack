// ABOUTME: Runs the SlackApp contract against the real Slack app on this Mac.
// ABOUTME: Restarts Slack several times, so it runs only with HACKSLACK_SMOKE=1 (`just smoke`).
import { describe } from "bun:test";
import { CdpSlackApp } from "../../src/slack/cdpSlackApp";
import { MacSlackProcess } from "../../src/slack/macSlackProcess";
import { slackAppContract } from "../contract/slackAppContract";

const log = (message: string) => console.log(`[smoke] ${message}`);

describe.skipIf(process.env.HACKSLACK_SMOKE !== "1")("real Slack", () => {
  slackAppContract("CdpSlackApp on macOS", () => new CdpSlackApp(new MacSlackProcess(log), log), 30_000);
});
