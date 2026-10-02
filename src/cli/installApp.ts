// ABOUTME: Builds ~/Applications/Hackslack.app, an AppleScript applet with Slack's icon that runs `main.ts open`.
// ABOUTME: Uses osacompile, PlistBuddy and codesign at install time; Slack.app is not modified.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { findSlackBinary } from "../slack/macProcesses";
import { REPO_ROOT } from "./state";

export interface InstallAppOptions {
  applicationsDir: string;
  repoRoot: string;
  bunPath: string;
  iconSource: string;
}

const shellQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;
const appleScriptString = (value: string) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

export function appletSource(repoRoot: string, bunPath: string): string {
  const stateDir = shellQuote(join(repoRoot, ".state"));
  const main = shellQuote(join(repoRoot, "src", "cli", "main.ts"));
  const log = shellQuote(join(repoRoot, ".state", "app.log"));
  const command = `mkdir -p ${stateDir} && exec ${shellQuote(bunPath)} ${main} open >> ${log} 2>&1`;
  return `do shell script ${appleScriptString(command)}`;
}

export function installApp(options: InstallAppOptions): string {
  const appPath = join(options.applicationsDir, "Hackslack.app");
  const icon = readFileSync(options.iconSource);
  mkdirSync(options.applicationsDir, { recursive: true });
  rmSync(appPath, { recursive: true, force: true });
  run("/usr/bin/osacompile", ["-o", appPath, "-e", appletSource(options.repoRoot, options.bunPath)]);
  run("/usr/libexec/PlistBuddy", ["-c", "Add :LSUIElement bool true", join(appPath, "Contents", "Info.plist")]);
  writeFileSync(join(appPath, "Contents", "Resources", "applet.icns"), icon);
  run("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", appPath]);
  return appPath;
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr.trim()}`);
}

export function installAppForThisMac(): string {
  return installApp({
    applicationsDir: join(homedir(), "Applications"),
    repoRoot: REPO_ROOT,
    bunPath: Bun.which("bun") ?? process.execPath,
    iconSource: join(findSlackBinary(), "..", "..", "Resources", "electron.icns"),
  });
}
