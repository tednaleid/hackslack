# hackslack

Restyles the Slack desktop app on macOS with CSS from `styles/`, without modifying Slack.app.

- Run `just --list` for the available commands. Use the recipes, not bun or playwright-cli directly.
- `just start`, `just inspect` and `just smoke` restart Ted's Slack. Ask Ted before running them.
- Domain terms (Normal mode, Inspect mode, Stylesheet, Slack page, Tab rail): `CONTEXT.md`.
- To find something in Slack's UI and hide or restyle it: `docs/inspect-workflow.md`.
- Why Normal mode uses a pipe and Inspect mode a port: `docs/adr/0001-pipe-by-default-port-on-demand.md`.
- Security rules the Launcher must keep: `docs/security.md`.
- Architecture is hexagonal. `src/core` depends only on the ports in `src/core/ports.ts`. Adapters live in `src/slack`, `src/stylesheets` and `src/cdp`; the CLI in `src/cli` is the driving side.
- Test the core and adapters with the fakes in `test/fakes`. `just test` needs no Slack. Any SlackApp change must keep `test/contract/slackAppContract.ts` passing for the fakes and, via `just smoke`, for real Slack.
- Every code file starts with two `ABOUTME:` comment lines.
