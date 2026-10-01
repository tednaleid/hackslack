// ABOUTME: Runs the SlackApp contract against the in-memory implementations.
// ABOUTME: Keeps the fakes honest; the same suite runs against real Slack in test/smoke.
import { CdpSlackApp } from "../../src/slack/cdpSlackApp";
import { slackAppContract } from "../contract/slackAppContract";
import { FakeChromiumProcess } from "../fakes/fakeChromium";
import { FakeSlackApp } from "../fakes/fakeSlackApp";

slackAppContract("FakeSlackApp", () => new FakeSlackApp(), 1000);
slackAppContract("CdpSlackApp with FakeChromium", () => new CdpSlackApp(new FakeChromiumProcess(), () => {}), 1000);
