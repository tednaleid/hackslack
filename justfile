# ABOUTME: Commands for running hackslack and working on its Stylesheets.
# ABOUTME: Run `just --list` to see what is available.

default:
    @just --list

# Run the fast tests (no Slack needed)
test:
    bun test
