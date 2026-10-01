// ABOUTME: Tests for FsStylesheets: combining styles/*.css in name order and watching for changes.
// ABOUTME: Uses a fresh temporary directory per test.
import { beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsStylesheets } from "../../src/stylesheets/fsStylesheets";
import { eventually } from "../helpers";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackslack-styles-"));
});

test("combines .css files in filename order, each under a comment naming it", async () => {
  writeFileSync(join(dir, "20-density.css"), ".b {}");
  writeFileSync(join(dir, "10-slackbot.css"), ".a {}");
  writeFileSync(join(dir, "notes.txt"), "not css");
  writeFileSync(join(dir, ".scratch.css"), ".hidden {}");
  expect(await new FsStylesheets(dir).load()).toBe("/* 10-slackbot.css */\n.a {}\n/* 20-density.css */\n.b {}");
});

test("returns empty CSS for an empty directory", async () => {
  expect(await new FsStylesheets(dir).load()).toBe("");
});

test("rejects when the styles directory does not exist", async () => {
  await expect(new FsStylesheets(join(dir, "missing")).load()).rejects.toThrow("ENOENT");
});

test("drops a deleted file's CSS on the next load", async () => {
  writeFileSync(join(dir, "a.css"), ".a {}");
  writeFileSync(join(dir, "b.css"), ".b {}");
  const stylesheets = new FsStylesheets(dir);
  rmSync(join(dir, "a.css"));
  expect(await stylesheets.load()).toBe("/* b.css */\n.b {}");
});

test("notifies after .css changes, ignores other files, and stops when unsubscribed", async () => {
  const stylesheets = new FsStylesheets(dir, 30);
  let changes = 0;
  const stop = stylesheets.watch(() => changes++);
  writeFileSync(join(dir, "notes.txt"), "ignored");
  await Bun.sleep(200);
  expect(changes).toBe(0);
  writeFileSync(join(dir, "a.css"), ".a {}");
  writeFileSync(join(dir, "a.css"), ".a { color: red }");
  await eventually(() => changes >= 1, 2000, "a change notification");
  stop();
  const seen = changes;
  writeFileSync(join(dir, "b.css"), ".b {}");
  await Bun.sleep(200);
  expect(changes).toBe(seen);
});
