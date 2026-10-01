# Pipe by default, debugging port only in Inspect mode

The Launcher starts Slack with `--remote-debugging-pipe` and applies the Stylesheets over that pipe, so in Normal mode only the Launcher can control the logged-in Slack session and nothing listens on TCP. An agent that wants to examine the live UI needs a CDP endpoint that playwright-cli can attach to, so Inspect mode relaunches Slack with `--remote-debugging-port` on a random 127.0.0.1 port instead of the pipe. Slack 4.52 (Electron 44) does not open the port when both flags are given, so the two modes cannot share a transport. While Inspect mode is on, any local process can drive Slack as Ted. Inspecting is occasional and styling is permanent, so that exposure is limited to the sessions spent working on Stylesheets.

## Considered Options

- **Always open a port.** Simplest, and playwright-cli can attach at any time, but it leaves Ted's Slack session (reading and posting messages) open to every local process all day.
- **Pipe only, plus inspection commands of our own** (DOM snapshot, query a selector, computed style, screenshot) served by the Launcher. Never opens a port, but means rebuilding and maintaining a slice of playwright-cli. Worth revisiting if endpoint security software starts flagging debug ports.

## Consequences

- Switching between Normal mode and Inspect mode restarts Slack, because Chromium reads these flags only at launch.
- The Launcher has one CDP client with two transports: null-byte-separated messages over the pipe in Normal mode, and a WebSocket to the port in Inspect mode, where it shares the port with playwright-cli. The Stylesheets apply the same way in both modes.
- In Normal mode the Launcher must keep running for as long as Slack does, because Slack exits as soon as the pipe closes.
- `just status` must report Inspect mode prominently, since a forgotten open port is the main risk this design accepts.
