# hackslack

Restyles the Slack desktop app on macOS with your own CSS, for example to hide buttons Slack's settings do not let you hide. Slack.app is never modified.

A small Bun launcher starts Slack with Chromium's remote debugging enabled, injects every `styles/*.css` file into the Slack page, and re-applies them whenever a file is saved.

## Requirements

- macOS with the Slack desktop app in `/Applications` or `~/Applications`
- [Bun](https://bun.sh) and [just](https://github.com/casey/just)
- [playwright-cli](https://www.npmjs.com/package/@playwright/cli), only for Inspect mode

There are no npm dependencies and no build step.

## Usage

Install the Hackslack app once:

```bash
just install-app
```

This creates `~/Applications/Hackslack.app` with Slack's icon. Clicking it brings styled Slack to the front, or starts it if Slack is quit or running without the Stylesheets (for example after Slack updates itself). Then:

- Keep Hackslack in the Dock instead of Slack, and add it to System Settings > General > Login Items.
- Turn off "Launch Slack on login" in Slack's own preferences, and remove Slack from Login Items.
- Run `just install-app` again if you move the repo or reinstall Bun. To remove it, delete `~/Applications/Hackslack.app`.

From a terminal:

```bash
just open       # what clicking Hackslack does
just start      # restart Slack in Normal mode with the Stylesheets applied
just status     # mode, whether the Stylesheets are applied, any open debugging port
just logs       # last lines of the launcher log
```

## Changing how Slack looks

Add or edit a file in `styles/`. Files are combined in filename order and applied within about a second, without restarting Slack.

To find the selector for something in Slack's UI, use Inspect mode:

```bash
just inspect    # restart Slack with a debugging port on 127.0.0.1
just attach     # connect playwright-cli to Slack
just detach     # disconnect and delete playwright-cli's captures
just start      # back to Normal mode
```

While Inspect mode is on, any local process can control your Slack session, and `just status` warns about it. Keep those sessions short. The full workflow, written for Claude Code agents, is in [docs/inspect-workflow.md](docs/inspect-workflow.md).

## How it works

- **Normal mode** launches Slack with `--remote-debugging-pipe`. Only the launcher holds the pipe, nothing listens on the network, and Slack exits when the launcher does.
- **Inspect mode** launches Slack with `--remote-debugging-port` on a random loopback port instead. Slack cannot use both at once; see [docs/adr/0001-pipe-by-default-port-on-demand.md](docs/adr/0001-pipe-by-default-port-on-demand.md).
- The only JavaScript run in Slack sets one `<style>` element. It is generated from the CSS and also registered to run on every reload. The launcher's security rules are in [docs/security.md](docs/security.md).

## Development

```bash
just test       # fast tests, no Slack needed
just smoke      # contract tests against the real Slack app (restarts Slack)
```

The code is hexagonal: `src/core` depends only on the ports in `src/core/ports.ts`. Terms are defined in [CONTEXT.md](CONTEXT.md).
