// ABOUTME: Tests for StyleKeeper, the core that keeps the Stylesheets applied to every Slack page.
// ABOUTME: Runs entirely against FakeSlackApp and FakeStylesheets.
import { expect, test } from "bun:test";
import { type KeeperStats, StyleKeeper } from "../../src/core/styleKeeper";
import { FAKE_PAGE, FakeSlackApp } from "../fakes/fakeSlackApp";
import { FakeStylesheets } from "../fakes/fakeStylesheets";
import { eventually } from "../helpers";

const SECOND_PAGE = { id: "page-2", url: "https://app.slack.com/client/T0000002" };

function setup(css = ".a {}") {
  const slack = new FakeSlackApp();
  const stylesheets = new FakeStylesheets(css);
  const logs: string[] = [];
  const stats: KeeperStats[] = [];
  const keeper = new StyleKeeper(slack, stylesheets, (m) => logs.push(m), (s) => stats.push(s));
  return { slack, stylesheets, keeper, logs, stats };
}

test("applies the Stylesheets to each Slack page as it becomes ready", async () => {
  const { slack, keeper } = setup(".a {}");
  const info = await keeper.start("normal");
  expect(info).toEqual({ slackPid: 4242, port: null });
  expect(slack.launchedMode).toBe("normal");
  await eventually(() => slack.applied.get(FAKE_PAGE.id) === ".a {}");
});

test("re-applies to every known page when the Stylesheets change", async () => {
  const { slack, stylesheets, keeper } = setup(".a {}");
  await keeper.start("inspect");
  await eventually(() => slack.applied.size === 1);
  slack.addPage(SECOND_PAGE);
  await eventually(() => slack.applied.get(SECOND_PAGE.id) === ".a {}");
  stylesheets.change(".b {}");
  await eventually(() => slack.applied.get(FAKE_PAGE.id) === ".b {}" && slack.applied.get(SECOND_PAGE.id) === ".b {}");
});

test("ends with the last saved CSS after rapid changes", async () => {
  const { slack, stylesheets, keeper } = setup(".a {}");
  await keeper.start("normal");
  await eventually(() => slack.applied.size === 1);
  stylesheets.change(".b {}");
  stylesheets.change(".c {}");
  await eventually(() => slack.applied.get(FAKE_PAGE.id) === ".c {}");
  await Bun.sleep(20);
  expect(slack.applied.get(FAKE_PAGE.id)).toBe(".c {}");
});

test("does not try to style a page after it is gone", async () => {
  const { slack, stylesheets, keeper, logs } = setup(".a {}");
  await keeper.start("normal");
  slack.addPage(SECOND_PAGE);
  await eventually(() => slack.applied.size === 2);
  slack.removePage(SECOND_PAGE.id);
  stylesheets.change(".b {}");
  await eventually(() => slack.applied.get(FAKE_PAGE.id) === ".b {}");
  expect(slack.applied.has(SECOND_PAGE.id)).toBe(false);
  expect(logs.some((line) => line.includes("could not apply"))).toBe(false);
});

test("logs a failed injection and still styles the other pages", async () => {
  const { slack, keeper, logs } = setup(".a {}");
  slack.failApplyFor.add(SECOND_PAGE.id);
  await keeper.start("normal");
  slack.addPage(SECOND_PAGE);
  await eventually(() => logs.some((line) => line.includes("could not apply Stylesheets to page page-2")));
  expect(slack.applied.get(FAKE_PAGE.id)).toBe(".a {}");
});

test("keeps the previous CSS and logs when reloading the Stylesheets fails", async () => {
  const { slack, stylesheets, keeper, logs } = setup(".a {}");
  await keeper.start("normal");
  await eventually(() => slack.applied.size === 1);
  stylesheets.loadError = new Error("EACCES: permission denied");
  stylesheets.change(".b {}");
  await eventually(() => logs.some((line) => line.includes("could not reload Stylesheets")));
  expect(slack.applied.get(FAKE_PAGE.id)).toBe(".a {}");
});

test("resolves exited with the reason and stops watching the Stylesheets", async () => {
  const { slack, stylesheets, keeper } = setup();
  await keeper.start("normal");
  expect(stylesheets.watcherCount).toBe(1);
  slack.exit("pipe closed by Slack");
  expect(await keeper.exited).toBe("pipe closed by Slack");
  expect(stylesheets.watcherCount).toBe(0);
});

test("stops watching and rethrows when Slack fails to launch", async () => {
  const { slack, stylesheets, keeper } = setup();
  slack.launchError = new Error("Slack not found");
  await expect(keeper.start("normal")).rejects.toThrow("Slack not found");
  expect(stylesheets.watcherCount).toBe(0);
});

test("reports injection and page counts", async () => {
  const { keeper, stats } = setup();
  await keeper.start("normal");
  await eventually(() => stats.some((s) => s.injectCount === 1));
  const last = stats.at(-1)!;
  expect(last.pageCount).toBe(1);
  expect(typeof last.lastInjectAt).toBe("string");
});
