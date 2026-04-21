<!-- Copyright 2026 LanEinstein. Licensed under Apache-2.0 (see LICENSE). -->
---
description: Consult Codex as an independent advisor during plan, investigation, or thinking phases. Output is supplementary; Claude remains canonical.
argument-hint: '<plan-critique|investigate|second-opinion> [target text or file path] [--timeout <seconds>] [--model <model|spark>] [--effort <none|minimal|low|medium|high|xhigh>] [--context-file <path>]'
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Bash(node:*), AskUserQuestion
---

Run a Codex advisory consult through the fork-added consult runtime.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is advisory-only. Codex runs read-only; Codex must not modify any files.
- Your only job is to run the consult and return the Codex runtime's stdout verbatim to the user or parent agent.
- Do not fix, rewrite, or implement anything based on the consult output during this command. That is Claude's job in the parent turn.

Mode validation:
- The first positional argument must be one of: `plan-critique`, `investigate`, `second-opinion`.
- If the first positional is missing or not one of those three, stop and reply:
  `Usage: /codex:consult <plan-critique|investigate|second-opinion> [target] [flags]`
- Do not attempt to run the consult without a valid mode.

Target handling:
- The remaining positional arguments form the target.
- For `plan-critique`, the target is typically a path to a plan document (e.g. `/home/ps/.claude/plans/*.md`). If the target is a valid file path, prepend its absolute path so the companion can resolve it.
- For `investigate` and `second-opinion`, the target is typically a free-form question or decision stated inline.
- When Claude has an initial view (for `second-opinion`) or supporting context (for all modes), pass it via `--context-file <path>` pointing at a temporary file Claude has written. Do not inline large context in the positional arguments.

Argument handling:
- Preserve the user's arguments exactly. Do not strip `--timeout`, `--model`, `--effort`, or `--context-file`.
- Do not add `--write`, `--background`, or any other flag the user did not supply.
- `/codex:consult` is advisory-only and runs in the foreground; there is no background mode in this release.

Execution:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" consult "$ARGUMENTS"
```

- Return the command stdout verbatim, exactly as-is.
- If stdout begins with the sentinel line `> [!WARNING] Codex oracle unavailable`, the Codex runtime chose to skip gracefully (auth, quota, timeout, network, not_installed). Pass the warning block through unchanged so Claude knows to proceed without Codex input.
- If stdout is a valid JSON object matching the consult schema, pass the JSON through unchanged for Claude to parse.
- Do not paraphrase, summarize, or add commentary before or after the consult output.
- Do not fix or implement anything in this command — consult is advisory for Claude's next turn.
