// ABOUTME: Tests for building the Hackslack.app applet that launches styled Slack from the Dock.
// ABOUTME: Builds a real applet with osacompile in a temporary directory, with a stand-in icon.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appletSource, installApp } from "../../src/cli/installApp";

test("the applet runs the open command with every path shell-quoted", () => {
  const source = appletSource("/Users/someone/code/it's hack slack", "/opt/homebrew/bin/bun");
  const quotedRoot = `'/Users/someone/code/it'\\\\''s hack slack`;
  expect(source).toBe(
    `do shell script "mkdir -p ${quotedRoot}/.state' && exec '/opt/homebrew/bin/bun' ${quotedRoot}/src/cli/main.ts' open >> ${quotedRoot}/.state/app.log' 2>&1"`,
  );
});

test("builds a signed Hackslack.app with Slack's icon and no Dock icon of its own, replacing any earlier one", () => {
  const dir = mkdtempSync(join(tmpdir(), "hackslack-app-"));
  const iconSource = join(dir, "electron.icns");
  writeFileSync(iconSource, "icon bytes");
  const options = { applicationsDir: join(dir, "Applications"), repoRoot: "/repo", bunPath: "/bin/bun", iconSource };
  installApp(options);
  const appPath = installApp(options);

  expect(appPath).toBe(join(dir, "Applications", "Hackslack.app"));
  const plist = readFileSync(join(appPath, "Contents", "Info.plist"), "utf8");
  expect(plist).toContain("<key>LSUIElement</key>\n\t<true/>");
  expect(readFileSync(join(appPath, "Contents", "Resources", "applet.icns"), "utf8")).toBe("icon bytes");
  expect(spawnSync("/usr/bin/codesign", ["--verify", appPath]).status).toBe(0);
});
