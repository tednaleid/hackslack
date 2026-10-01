// ABOUTME: The ports the core depends on: the Slack app it styles and the Stylesheets it applies.
// ABOUTME: Adapters in src/slack and src/stylesheets implement these; tests use fakes.

export type Mode = "normal" | "inspect";

export interface SlackPage {
  id: string;
  url: string;
}

export interface SlackAppEvents {
  pageReady(page: SlackPage): void;
  pageGone(pageId: string): void;
  exited(reason: string): void;
}

export interface LaunchInfo {
  slackPid: number;
  port: number | null;
}

export interface SlackApp {
  launch(mode: Mode, events: SlackAppEvents): Promise<LaunchInfo>;
  applyCss(pageId: string, css: string): Promise<void>;
  readAppliedCss(pageId: string): Promise<string | null>;
  close(): Promise<void>;
}

export interface Stylesheets {
  load(): Promise<string>;
  watch(onChange: () => void): () => void;
}
