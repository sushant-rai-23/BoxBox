// Tests for task briefs: the parser in hooks/routing.js and the kit's brief template.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const R = require("../../hooks/routing.js");

const BRIEF = [
  "# Brief: E2.3 tokens expire after 15 minutes",
  "task: E2.3",
  "size: M",
  "risk: yes",
  "expected_diff: 90",
  "files:",
  "- app/resets.py",
  "- tests/test_resets.py",
  "base: a1b2c3d",
  "",
  "## Goal",
  "A reset token older than 15 minutes is refused.",
  "",
  "## Code to touch",
  "- `app/resets.py:42` `check_token()`: compare created_at",
  "files: this line is not the files list"
].join("\n");

test("brief: parser reads files and expected diff size from a brief", () => {
  assert.deepEqual(R.parseBrief(BRIEF), {
    task: "E2.3", size: "M", risk: true, expectedDiff: 90,
    files: ["app/resets.py", "tests/test_resets.py"], base: "a1b2c3d",
    goal: "A reset token older than 15 minutes is refused."
  });
});

test("brief: Windows line endings and trailing spaces parse the same", () => {
  const b = R.parseBrief(BRIEF.replace(/\n/g, "  \r\n"));
  assert.equal(b.goal, "A reset token older than 15 minutes is refused.");
  assert.deepEqual(b.files, ["app/resets.py", "tests/test_resets.py"]);
  assert.equal(b.expectedDiff, 90);
});

test("brief: a missing expected_diff comes from the size, a missing size is M", () => {
  const b = R.parseBrief("task: E1.1\nsize: L\nfiles:\n- a.js\n");
  assert.equal(b.expectedDiff, 400);
  assert.equal(R.parseBrief("task: E1.2\n").expectedDiff, 150);
  assert.equal(R.parseBrief("task: E1.2\n").size, "M");
  assert.deepEqual(R.parseBrief("").files, []);
  assert.equal(R.parseBrief("").task, "");
});

test("brief: the kit's template parses and names every section the GUIDE requires", () => {
  const t = fs.readFileSync(path.join(__dirname, "../../skills/boxbox-setup/kit/templates/brief.md"), "utf8");
  for (const h of ["## Goal", "## Code to touch", "## Interface", "## Tests", "## Do not touch", "## Done when", "## Commands"])
    assert.ok(t.includes(h), `template has ${h}`);
  const b = R.parseBrief(t);
  assert.ok(/^E\d+\.\d+$/.test(b.task) || b.task.startsWith("<"), "task line present");
  assert.ok(Array.isArray(b.files));
});
