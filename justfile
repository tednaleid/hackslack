# ABOUTME: Commands for running hackslack and working on its Stylesheets.
# ABOUTME: Run `just --list` to see what is available.

default:
    @just --list

# Restart Slack in Normal mode with the Stylesheets applied
start:
    bun src/cli/main.ts start normal

# Restart Slack in Inspect mode: Stylesheets applied plus a debugging port on 127.0.0.1
inspect:
    bun src/cli/main.ts start inspect

# Attach playwright-cli to Slack (Inspect mode only)
attach:
    port="$(bun src/cli/main.ts port)" && playwright-cli attach --cdp="http://127.0.0.1:$port"

# Detach playwright-cli from Slack, leaving Slack running, and delete its captures (they can hold message text)
detach:
    -playwright-cli detach
    rm -rf .playwright-cli

# Show the mode, whether the Stylesheets are applied, and any open debugging port
status:
    bun src/cli/main.ts status

# Show the last lines of the Launcher log
logs lines="100":
    tail -n {{lines}} .state/launcher.log

# Run the fast tests (no Slack needed)
test:
    bun test

# Run the SlackApp contract against real Slack (restarts Slack; ask Ted first)
smoke:
    HACKSLACK_SMOKE=1 bun test smoke
