# Launcher security rules

The Launcher can control Ted's logged-in Slack session, so it keeps these rules. A change that breaks one needs Ted's agreement and an ADR.

1. Normal mode opens no TCP listener. It uses `--remote-debugging-pipe`, whose file descriptors only the Launcher holds. Inspect mode binds only 127.0.0.1 on a random port, and `just status` warns while it is open.
2. The Launcher makes no network requests except to Slack's own debugging endpoint on 127.0.0.1 in Inspect mode.
3. Only the `Target`, `Page` and `Runtime` CDP domains are used. `Runtime.evaluate` runs only the snippet from `buildInjectionSource` (CSS embedded with `JSON.stringify`) or the constant `READ_APPLIED_CSS`. Both are in `src/cdp/injection.ts`.
4. Logs never contain Slack message content. CDP events are not logged.
5. The only child processes are Slack itself, `pgrep`, `lsof` and `osascript`.

Never add `--remote-allow-origins=*`: it would let any web page open in a browser drive Slack while Inspect mode is on.

Anything in `styles/` is applied to Slack as written. An `@import url(...)` would make Slack fetch that URL, so do not use one.
