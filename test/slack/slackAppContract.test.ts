// ABOUTME: Runs the SlackApp contract against the in-memory implementations.
// ABOUTME: Keeps the fakes honest; the same suite runs against real Slack in test/smoke.
import { slackAppContract } from "../contract/slackAppContract";
import { FakeSlackApp } from "../fakes/fakeSlackApp";

slackAppContract("FakeSlackApp", () => new FakeSlackApp(), 1000);
