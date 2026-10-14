// Tests for agents/*.md: the Claude Code plugin agent files.
// Run: node --test tests/pitwall/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "..", "agents");

// Tiny parser: frontmatter is the text between the first two `---` lines, one `key: value` per line.
function parse(text) {
  const lines = text.split("\n");
  assert.equal(lines[0].trim(), "---", "file must start with ---");
  const end = lines.indexOf("---", 1);
  assert.ok(end > 0, "frontmatter must close with ---");
  const meta = {};
  for (const line of lines.slice(1, end)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: lines.slice(end + 1) };
}

const expected = {
  "boxbox-builder": { model: "sonnet", tools: "Read, Edit, Write, Bash, Grep, Glob" },
  "boxbox-scout": { model: "haiku", tools: "Read, Grep, Glob" },
  "boxbox-runner": { model: "haiku", tools: "Read, Edit, Bash, Grep, Glob" },
  "boxbox-writer": { model: "sonnet", tools: "Read, Write, Edit, Bash, Grep, Glob" },
};

test("agents: four boxbox agents with expected models and tools", () => {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  assert.deepEqual(files, Object.keys(expected).map((n) => n + ".md").sort());
  for (const [name, want] of Object.entries(expected)) {
    const { meta, body } = parse(fs.readFileSync(path.join(dir, name + ".md"), "utf8"));
    assert.equal(meta.name, name);
    assert.ok(meta.description && meta.description.length > 0, name + " needs a description");
    assert.equal(meta.model, want.model, name + " model");
    assert.equal(meta.tools, want.tools, name + " tools");
    assert.ok(body.length < 60, name + " body must be under 60 lines, got " + body.length);
    assert.ok(body.some((l) => l.startsWith("Never")), name + " needs a line starting with Never");
  }
});
