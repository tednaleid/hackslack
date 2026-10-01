# ABOUTME: Commands for running hackslack and working on its Stylesheets.
# ABOUTME: Run `just --list` to see what is available.

default:
    @just --list

# Run the fast tests (no Slack needed)
test:
    bun test

# Run the SlackApp contract against real Slack (restarts Slack; ask Ted first)
smoke:
    HACKSLACK_SMOKE=1 bun test smoke
