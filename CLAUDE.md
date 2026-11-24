<!--
  FILE    : CLAUDE.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-19_1455 UTC
  PURPOSE : Standing instructions for Claude Code sessions in this repository.
-->
# Instructions for Claude

## Shipping changes
- When a change is done and checks pass (`npx tsc --noEmit -p apps/web` at minimum), **open a pull request and merge it to `main` without asking**. This is standing approval from the repo owner.
- Bring the working branch up to date with `main` before starting, so the PR only carries the new change.
- Don't merge if the type check or CI fails — fix it first, or report what's blocking.
