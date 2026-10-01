# Launcher v1 design

Settled in a design session with Ted on 2026-10-01. Terms are defined in `CONTEXT.md`; the transport decision is in `docs/adr/0001-pipe-by-default-port-on-demand.md`.

## What it does

- `just start` quits any running Slack and relaunches it in Normal mode with every `styles/*.css` file applied. `just inspect` does the same in Inspect mode.
- The Launcher runs in the background for as long as Slack does, watches `styles/`, and re-applies the CSS within about a second of a save.
- In Inspect mode, `just attach` connects playwright-cli to Slack so Ted or an agent can examine the live UI.
- `just status` reports the mode, whether Slack is running under the Launcher, and how often the Stylesheets were applied. It warns loudly whenever Slack has a debugging port open.
- The first Stylesheet hides the Slackbot button in the Tab rail.

## Decisions

- Runtime: Bun with TypeScript, no npm dependencies, `bun test`. uv Python scripts only for one-off helpers.
- Launcher, not supervisor: no launchd agent, no takeover of a Slack started from the Dock. If Slack restarts itself (auto-update), it comes back without Stylesheets; the Launcher logs the exit and `just status` says so.
- Normal mode uses `--remote-debugging-pipe`. Inspect mode uses `--remote-debugging-port` on a random 127.0.0.1 port, and the Launcher connects to that port over a WebSocket. Slack 4.52 cannot do both at once.
- Inspect mode ends only when someone runs `just start`. No timeout.
- Stylesheets live in the repo under `styles/`, combined in filename order.
- Hexagonal: the core depends on two driven ports, `SlackApp` and `Stylesheets`. CDP framing and the CDP client are tested against in-memory fakes. One contract suite runs against the fake `SlackApp`, against the real CDP adapter driving a fake Chromium, and (by hand, `just smoke`) against real Slack.
- CLAUDE.md stays around 20 lines and links to docs for detail.

## Security rules

1. Normal mode opens no TCP listener. Inspect mode binds only 127.0.0.1 on a random port, and `just status` warns while it is open.
2. The Launcher makes no network requests except to Slack's own debugging endpoint on 127.0.0.1 in Inspect mode.
3. Only the `Target`, `Page` and `Runtime` CDP domains are used. `Runtime.evaluate` runs only the injection snippet generated from the CSS with `JSON.stringify`, or the constant expression that reads the applied CSS back.
4. Logs never contain Slack message content. CDP events are not logged.
5. The only child processes are Slack itself, `pgrep`, `lsof` and `osascript`.

## Done for v1

- In Normal mode the Slackbot button stays hidden after Cmd+R and after switching workspaces.
- Saving a Stylesheet updates Slack within about a second, without a restart.
- In Normal mode, `lsof` shows no TCP listener for Slack.
- An agent can go from `just inspect` to a committed new Stylesheet by following `docs/inspect-workflow.md` alone.

## Facts from the spike (Slack 4.52.162, Electron 44.3.0, Chromium 152)

- `--remote-debugging-pipe` works. Slack exits with code 0 within about 0.3s of the pipe closing.
- With both `--remote-debugging-pipe` and `--remote-debugging-port`, no port is opened. The port works on its own, and playwright-cli can attach to it.
- There is one Slack page for all workspaces, at `https://app.slack.com/client/<team id>`. Switching workspaces changes the URL of that page. A service worker target also exists and must be ignored.
- The page target is first announced with an empty URL, then `Target.targetInfoChanged` (several times) gives it the Slack URL.
- The Slackbot button is `[data-qa="tab_rail_slackbot_button"]`, inside `[data-qa="draggable_tab_item"]`, which also holds its label. Only some workspaces have it. The separate `[data-qa="slackbot-ai-button"]` is the sparkle button next to search, which v1 does not hide.
