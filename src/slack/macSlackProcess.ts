// ABOUTME: Starts the Slack app on macOS in Normal mode (debugging pipe) or Inspect mode (loopback port).
// ABOUTME: Quits any running Slack first; Slack 4.52 cannot use the pipe and a port at the same time.
import { spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { pipeTransport } from "../cdp/pipeTransport";
import { webSocketTransport } from "../cdp/webSocketTransport";
import type { Log } from "../core/log";
import type { Mode } from "../core/ports";
import type { SlackConnection, SlackProcess } from "./cdpSlackApp";
import { findSlackBinary, pickFreePort, quitRunningSlack, waitForDebuggerUrl } from "./macProcesses";

export interface MacSlackProcessOptions {
  binaryPath?: string;
  debuggerTimeoutMs?: number;
  quitRunningSlack?: (log: Log) => Promise<void>;
}

export class MacSlackProcess implements SlackProcess {
  private readonly binaryPath: string;
  private readonly debuggerTimeoutMs: number;
  private readonly quitRunningSlack: (log: Log) => Promise<void>;

  constructor(
    private readonly log: Log,
    options: MacSlackProcessOptions = {},
  ) {
    this.binaryPath = options.binaryPath ?? findSlackBinary();
    this.debuggerTimeoutMs = options.debuggerTimeoutMs ?? 30_000;
    this.quitRunningSlack = options.quitRunningSlack ?? quitRunningSlack;
  }

  async start(mode: Mode): Promise<SlackConnection> {
    await this.quitRunningSlack(this.log);
    return mode === "normal" ? this.startWithPipe() : this.startWithPort();
  }

  private startWithPipe(): SlackConnection {
    const child = spawn(this.binaryPath, ["--remote-debugging-pipe"], {
      stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"],
    });
    child.on("error", (error) => this.log(`Slack process error: ${error.message}`));
    if (child.pid === undefined) throw new Error(`could not start ${this.binaryPath}`);
    child.on("exit", (code, signal) => this.log(`Slack process exited code=${code} signal=${signal}`));
    this.log(`started Slack pid=${child.pid} in Normal mode`);
    const transport = pipeTransport(child.stdio[3] as Writable, child.stdio[4] as Readable);
    return { transport, slackPid: child.pid, port: null };
  }

  private async startWithPort(): Promise<SlackConnection> {
    const port = await pickFreePort();
    const child = spawn(this.binaryPath, [`--remote-debugging-port=${port}`], { detached: true, stdio: "ignore" });
    child.on("error", (error) => this.log(`Slack process error: ${error.message}`));
    if (child.pid === undefined) throw new Error(`could not start ${this.binaryPath}`);
    child.unref();
    this.log(`started Slack pid=${child.pid} in Inspect mode; debugging port ${port} is open on 127.0.0.1`);
    try {
      const url = await waitForDebuggerUrl(port, this.debuggerTimeoutMs);
      return { transport: await webSocketTransport(url), slackPid: child.pid, port };
    } catch (error) {
      this.log(`could not connect to Slack's debugging port; stopping Slack pid=${child.pid}`);
      process.kill(child.pid, "SIGTERM");
      throw error;
    }
  }
}
