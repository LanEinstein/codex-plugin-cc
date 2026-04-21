# Codex plugin for Claude Code

**[English](./README.md)** · [中文](./README.zh.md)

> This is a fork of [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) by [LanEinstein](https://github.com/LanEinstein). See [Fork additions](#fork-additions-laneinstein) for what's new; everything else tracks upstream.

Use Codex from inside Claude Code for code reviews or to delegate tasks to Codex.

This plugin is for Claude Code users who want an easy way to start using Codex from the workflow
they already have.

<video src="./docs/plugin-demo.webm" controls muted playsinline autoplay></video>

## What You Get

- `/codex:review` for a normal read-only Codex review
- `/codex:adversarial-review` for a steerable challenge review
- `/codex:rescue`, `/codex:status`, `/codex:result`, and `/codex:cancel` to delegate work and manage background jobs

## Requirements

- **ChatGPT subscription (incl. Free) or OpenAI API key.**
  - Usage will contribute to your Codex usage limits. [Learn more](https://developers.openai.com/codex/pricing).
- **Node.js 18.18 or later**

## Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add openai/codex-plugin-cc
```

Install the plugin:

```bash
/plugin install codex@openai-codex
```

Reload plugins:

```bash
/reload-plugins
```

Then run:

```bash
/codex:setup
```

`/codex:setup` will tell you whether Codex is ready. If Codex is missing and npm is available, it can offer to install Codex for you.

If you prefer to install Codex yourself, use:

```bash
npm install -g @openai/codex
```

If Codex is installed but not logged in yet, run:

```bash
!codex login
```

After install, you should see:

- the slash commands listed below
- the `codex:codex-rescue` subagent in `/agents`

One simple first run is:

```bash
/codex:review --background
/codex:status
/codex:result
```

## Usage

### `/codex:review`

Runs a normal Codex review on your current work. It gives you the same quality of code review as running `/review` inside Codex directly.

> [!NOTE]
> Code review especially for multi-file changes might take a while. It's generally recommended to run it in the background.

Use it when you want:

- a review of your current uncommitted changes
- a review of your branch compared to a base branch like `main`

Use `--base <ref>` for branch review. It also supports `--wait` and `--background`. It is not steerable and does not take custom focus text. Use [`/codex:adversarial-review`](#codexadversarial-review) when you want to challenge a specific decision or risk area.

Examples:

```bash
/codex:review
/codex:review --base main
/codex:review --background
```

This command is read-only and will not perform any changes. When run in the background you can use [`/codex:status`](#codexstatus) to check on the progress and [`/codex:cancel`](#codexcancel) to cancel the ongoing task.

### `/codex:adversarial-review`

Runs a **steerable** review that questions the chosen implementation and design.

It can be used to pressure-test assumptions, tradeoffs, failure modes, and whether a different approach would have been safer or simpler.

It uses the same review target selection as `/codex:review`, including `--base <ref>` for branch review.
It also supports `--wait` and `--background`. Unlike `/codex:review`, it can take extra focus text after the flags.

Use it when you want:

- a review before shipping that challenges the direction, not just the code details
- review focused on design choices, tradeoffs, hidden assumptions, and alternative approaches
- pressure-testing around specific risk areas like auth, data loss, rollback, race conditions, or reliability

Examples:

```bash
/codex:adversarial-review
/codex:adversarial-review --base main challenge whether this was the right caching and retry design
/codex:adversarial-review --background look for race conditions and question the chosen approach
```

This command is read-only. It does not fix code.

### `/codex:rescue`

Hands a task to Codex through the `codex:codex-rescue` subagent.

Use it when you want Codex to:

- investigate a bug
- try a fix
- continue a previous Codex task
- take a faster or cheaper pass with a smaller model

> [!NOTE]
> Depending on the task and the model you choose these tasks might take a long time and it's generally recommended to force the task to be in the background or move the agent to the background.

It supports `--background`, `--wait`, `--resume`, and `--fresh`. If you omit `--resume` and `--fresh`, the plugin can offer to continue the latest rescue thread for this repo.

Examples:

```bash
/codex:rescue investigate why the tests started failing
/codex:rescue fix the failing test with the smallest safe patch
/codex:rescue --resume apply the top fix from the last run
/codex:rescue --model gpt-5.4-mini --effort medium investigate the flaky integration test
/codex:rescue --model spark fix the issue quickly
/codex:rescue --background investigate the regression
```

You can also just ask for a task to be delegated to Codex:

```text
Ask Codex to redesign the database connection to be more resilient.
```

**Notes:**

- if you do not pass `--model` or `--effort`, Codex chooses its own defaults.
- if you say `spark`, the plugin maps that to `gpt-5.3-codex-spark`
- follow-up rescue requests can continue the latest Codex task in the repo

### `/codex:status`

Shows running and recent Codex jobs for the current repository.

Examples:

```bash
/codex:status
/codex:status task-abc123
```

Use it to:

- check progress on background work
- see the latest completed job
- confirm whether a task is still running

### `/codex:result`

Shows the final stored Codex output for a finished job.
When available, it also includes the Codex session ID so you can reopen that run directly in Codex with `codex resume <session-id>`.

Examples:

```bash
/codex:result
/codex:result task-abc123
```

### `/codex:cancel`

Cancels an active background Codex job.

Examples:

```bash
/codex:cancel
/codex:cancel task-abc123
```

### `/codex:setup`

Checks whether Codex is installed and authenticated.
If Codex is missing and npm is available, it can offer to install Codex for you.

You can also use `/codex:setup` to manage the optional review gate.

#### Enabling review gate

```bash
/codex:setup --enable-review-gate
/codex:setup --disable-review-gate
```

When the review gate is enabled, the plugin uses a `Stop` hook to run a targeted Codex review based on Claude's response. If that review finds issues, the stop is blocked so Claude can address them first.

> [!WARNING]
> The review gate can create a long-running Claude/Codex loop and may drain usage limits quickly. Only enable it when you plan to actively monitor the session.

## Typical Flows

### Review Before Shipping

```bash
/codex:review
```

### Hand A Problem To Codex

```bash
/codex:rescue investigate why the build is failing in CI
```

### Start Something Long-Running

```bash
/codex:adversarial-review --background
/codex:rescue --background investigate the flaky test
```

Then check in with:

```bash
/codex:status
/codex:result
```

## Codex Integration

The Codex plugin wraps the [Codex app server](https://developers.openai.com/codex/app-server). It uses the global `codex` binary installed in your environment and [applies the same configuration](https://developers.openai.com/codex/config-basic).

### Common Configurations

If you want to change the default reasoning effort or the default model that gets used by the plugin, you can define that inside your user-level or project-level `config.toml`. For example to always use `gpt-5.4-mini` on `high` for a specific project you can add the following to a `.codex/config.toml` file at the root of the directory you started Claude in:

```toml
model = "gpt-5.4-mini"
model_reasoning_effort = "high"
```

Your configuration will be picked up based on:

- user-level config in `~/.codex/config.toml`
- project-level overrides in `.codex/config.toml`
- project-level overrides only load when the [project is trusted](https://developers.openai.com/codex/config-advanced#project-config-files-codexconfigtoml)

Check out the Codex docs for more [configuration options](https://developers.openai.com/codex/config-reference).

### Moving The Work Over To Codex

Delegated tasks and any [stop gate](#what-does-the-review-gate-do) run can also be directly resumed inside Codex by running `codex resume` either with the specific session ID you received from running `/codex:result` or `/codex:status` or by selecting it from the list.

This way you can review the Codex work or continue the work there.

<!-- Fork additions below © 2026 LanEinstein. Licensed under Apache-2.0. -->

## Fork additions (LanEinstein)

This section documents features specific to the `LanEinstein/codex-plugin-cc` fork.
All upstream commands and behaviors remain unchanged.

### `/codex:consult` — Codex as an independent advisor

During Claude Code's plan / investigate / thinking phases, delegate a specific advisory question to Codex. Claude remains canonical; Codex's structured output is supplementary information that Claude reads and integrates as it refines its plan.

Consult is **advisory-only**. Codex runs with `sandbox: read-only` and never modifies files in this flow. No `--write` flag is exposed.

#### Three modes

| Mode | Use when |
|------|----------|
| `plan-critique` | Ask Codex to critique a plan document: hidden assumptions, failure modes, simpler alternatives, concrete risks. If the target is a valid file path, the plan contents are read from disk. |
| `investigate` | Ask Codex to independently investigate a specific question as supplementary research. |
| `second-opinion` | Ask Codex for a contrasting perspective on a decision. Structured output includes an explicit `disagreements` array contrasting Claude's view with Codex's view. |

#### Usage

```bash
/codex:consult plan-critique ./path/to/my-plan.md
/codex:consult investigate "Is SQLite safe for concurrent writes across processes?"
/codex:consult second-opinion "Redis vs Postgres for a durable job queue at 1k qps"
```

#### Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--timeout <seconds>` | `90` | Hard timeout. On expiry Codex oracle skips gracefully (`reason=timeout`). |
| `--model <model>` | auto (Codex default) | Override Codex model. Accepts `spark` → `gpt-5.3-codex-spark`. |
| `--effort <level>` | auto | Reasoning effort: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`. |
| `--context-file <path>` | — | Read supplementary context from a file. For `second-opinion`, use this to pass Claude's initial view. |

Consult runs in the foreground only in this release. Background mode is not supported.

#### Output

On success, consult emits a JSON object to stdout matching [`plugins/codex/schemas/consult-output.schema.json`](./plugins/codex/schemas/consult-output.schema.json):

```json
{
  "mode": "plan-critique",
  "summary": "One-paragraph ship/no-ship take on the plan.",
  "confidence": "medium",
  "findings": [
    {
      "title": "...",
      "severity": "high",
      "detail": "...",
      "evidence": "Plan §3.2",
      "suggestion": "Add an idempotency guard before retry."
    }
  ],
  "disagreements": [],
  "open_questions": []
}
```

Claude reads this JSON and integrates valuable points into its plan while dismissing ones it disagrees with. Codex's output is supplementary, not canonical.

### `codex-oracle` subagent

Claude can invoke the `codex-oracle` subagent proactively when it decides a plan / investigation / decision benefits from an independent second opinion. The subagent is a thin forwarder to `/codex:consult` — it runs in an isolated context so Codex's output does not pollute the main thread's context window.

When to expect Claude to invoke it automatically:

- Drafting a non-trivial plan and the tradeoffs are unclear
- Investigating unfamiliar code or a concept Claude is uncertain about
- Having formed an initial view and wanting a contrasting perspective

Claude will **not** invoke it for trivial asks it can handle directly.

### Graceful degradation

If Codex is unavailable, consult exits 0 and emits a warning block starting with:

```
> [!WARNING] Codex oracle unavailable — reason: <class>
> <hint> Proceeding without Codex input.
```

Claude detects this sentinel and proceeds without Codex input. **Consult unavailability never blocks Claude's progress.** Skip is classified into one of:

| Reason | Typical cause | Hint surfaced to Claude |
|--------|---------------|-------------------------|
| `auth` | Codex login missing or 401 | Run `/codex:setup` to authenticate. |
| `quota` | Usage limit reached / 429 | Codex usage limit reached. |
| `timeout` | No response within `--timeout` | Increase `--timeout` or retry later. |
| `network` | Connection refused / DNS failure | Check your network connection. |
| `not_installed` | Codex CLI absent or broken | Run `/codex:setup` to install Codex. |
| `unknown` | Any other error | See detail line. |

All skip paths exit 0 because absence of a supplementary signal is not an error from Claude's perspective.

### Install this fork

```bash
/plugin marketplace add LanEinstein/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
```

The fork preserves the upstream package name (`openai-codex`) and bumps the version to `1.1.0-consult.1`. Existing `/codex:review`, `/codex:rescue`, etc. continue to work identically to upstream.

### License

Apache-2.0, inherited from upstream. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).

<!-- End fork additions -->

## FAQ

### Do I need a separate Codex account for this plugin?

If you are already signed into Codex on this machine, that account should work immediately here too. This plugin uses your local Codex CLI authentication.

If you only use Claude Code today and have not used Codex yet, you will also need to sign in to Codex with either a ChatGPT account or an API key. [Codex is available with your ChatGPT subscription](https://developers.openai.com/codex/pricing/), and [`codex login`](https://developers.openai.com/codex/cli/reference/#codex-login) supports both ChatGPT and API key sign-in. Run `/codex:setup` to check whether Codex is ready, and use `!codex login` if it is not.

### Does the plugin use a separate Codex runtime?

No. This plugin delegates through your local [Codex CLI](https://developers.openai.com/codex/cli/) and [Codex app server](https://developers.openai.com/codex/app-server/) on the same machine.

That means:

- it uses the same Codex install you would use directly
- it uses the same local authentication state
- it uses the same repository checkout and machine-local environment

### Will it use the same Codex config I already have?

Yes. If you already use Codex, the plugin picks up the same [configuration](#common-configurations).

### Can I keep using my current API key or base URL setup?

Yes. Because the plugin uses your local Codex CLI, your existing sign-in method and config still apply.

If you need to point the built-in OpenAI provider at a different endpoint, set `openai_base_url` in your [Codex config](https://developers.openai.com/codex/config-advanced/#config-and-state-locations).
