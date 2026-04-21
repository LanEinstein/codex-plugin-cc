// Copyright 2026 LanEinstein. Licensed under Apache-2.0 (see LICENSE).

import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { buildEnv, installFakeCodex } from "./fake-codex-fixture.mjs";
import { makeTempDir, run } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_ROOT = path.join(ROOT, "plugins", "codex");
const SCRIPT = path.join(PLUGIN_ROOT, "scripts", "codex-companion.mjs");
const SKIP_SENTINEL_RE = /^> \[!WARNING\] Codex oracle unavailable — reason: (\w+)/;

function consult(args, binDir, cwd) {
  return run("node", [SCRIPT, "consult", ...args], {
    cwd: cwd ?? makeTempDir("consult-cwd-"),
    env: buildEnv(binDir)
  });
}

function readFixtureState(binDir) {
  return JSON.parse(fs.readFileSync(path.join(binDir, "fake-codex-state.json"), "utf8"));
}

test("consult plan-critique returns structured JSON with findings", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir);

  const result = consult(
    ["plan-critique", "Plan: build an auth system using JWT tokens only."],
    binDir
  );

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.mode, "plan-critique");
  assert.ok(payload.summary, "summary should be present");
  assert.ok(Array.isArray(payload.findings), "findings should be an array");
  assert.ok(payload.findings.length >= 1, "at least one finding expected");
  for (const finding of payload.findings) {
    assert.ok(finding.title);
    assert.ok(["critical", "high", "medium", "low", "info"].includes(finding.severity));
    assert.ok(finding.detail);
  }
});

test("consult investigate returns structured JSON with mode=investigate", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir);

  const result = consult(
    ["investigate", "Is SQLite safe for concurrent writes across multiple processes?"],
    binDir
  );

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.mode, "investigate");
  assert.ok(payload.summary);
});

test("consult second-opinion populates disagreements array", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir);

  const result = consult(
    ["second-opinion", "Redis vs Postgres for a durable job queue at 1k qps"],
    binDir
  );

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.mode, "second-opinion");
  assert.ok(Array.isArray(payload.disagreements));
  assert.ok(payload.disagreements.length >= 1, "disagreements should be populated");
  for (const d of payload.disagreements) {
    assert.ok(d.claude_view);
    assert.ok(d.codex_view);
    assert.ok(d.reasoning);
  }
});

test("consult plan-critique reads file target when path exists on disk", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir);
  const planPath = path.join(binDir, "sample-plan.md");
  fs.writeFileSync(planPath, "# Plan\n\n1. Do X.\n2. Do Y.\n");

  const result = consult(["plan-critique", planPath], binDir);

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.mode, "plan-critique");
  const state = readFixtureState(binDir);
  assert.match(
    state.lastTurnStart.prompt,
    /Do X\./,
    "prompt should contain file contents, not just the path"
  );
});

test("consult --context-file contents reach Codex as CONTEXT", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir);
  const ctx = path.join(binDir, "ctx.md");
  const marker = "CTX_MARKER_FOR_TEST_9F2A";
  fs.writeFileSync(ctx, `Supporting context. ${marker}.`);

  const result = consult(
    ["investigate", "some question text", "--context-file", ctx],
    binDir
  );

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const state = readFixtureState(binDir);
  assert.match(state.lastTurnStart.prompt, new RegExp(marker));
});

test("consult passes --model and --effort through to Codex turn/start", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir);

  const result = consult(
    ["investigate", "question", "--model", "gpt-5.4-mini", "--effort", "high"],
    binDir
  );

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const state = readFixtureState(binDir);
  assert.equal(state.lastTurnStart.model, "gpt-5.4-mini");
  assert.equal(state.lastTurnStart.effort, "high");
});

test("consult skips gracefully when Codex is not logged in (auth preflight)", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir, "logged-out");

  const result = consult(["investigate", "test"], binDir);

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const match = result.stdout.match(SKIP_SENTINEL_RE);
  assert.ok(match, `expected skip sentinel, got: ${result.stdout}`);
  assert.equal(match[1], "auth");
});

test("consult skips gracefully on quota error during turn/start", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir, "consult-quota-fail");

  const result = consult(["investigate", "test"], binDir);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /reason: quota/);
});

test("consult skips gracefully on network error during turn/start", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir, "consult-network-fail");

  const result = consult(["investigate", "test"], binDir);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /reason: network/);
});

test("consult skips gracefully on turn-level auth error", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir, "consult-auth-turn-fail");

  const result = consult(["investigate", "test"], binDir);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /reason: auth/);
});

test("consult times out with --timeout=2 when Codex hangs", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir, "consult-hang");

  const started = Date.now();
  const result = consult(["investigate", "test", "--timeout", "2"], binDir);
  const elapsed = Date.now() - started;

  assert.equal(result.status, 0);
  assert.match(result.stdout, /reason: timeout/);
  assert.ok(elapsed < 15000, `timeout should fire around 2s, took ${elapsed}ms`);
});

test("consult falls back to unstructured envelope when Codex returns non-JSON", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir, "consult-unstructured");

  const result = consult(["investigate", "test"], binDir);

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.mode, "investigate");
  assert.equal(payload.status, "unstructured");
  assert.ok(payload.raw, "raw field should contain the non-JSON text");
});

test("consult errors when mode is missing", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir);

  const result = consult([], binDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /plan-critique\|investigate\|second-opinion/);
});

test("consult errors when mode is invalid", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir);

  const result = consult(["bogus-mode", "target"], binDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /plan-critique\|investigate\|second-opinion/);
});

test("consult errors when target is missing for a valid mode", () => {
  const binDir = makeTempDir();
  installFakeCodex(binDir);

  const result = consult(["investigate"], binDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /target is required/i);
});

test("dispatcher help advertises consult subcommand", () => {
  const result = run("node", [SCRIPT, "--help"], { cwd: ROOT, env: process.env });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /consult <plan-critique\|investigate\|second-opinion>/);
});
