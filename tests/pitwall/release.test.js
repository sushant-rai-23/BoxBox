// The release: one version everywhere a user or an installer reads it.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const VERSION = "0.7.0";

test("release: every manifest says 0.7.0", () => {
  for (const f of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json", ".cursor-plugin/plugin.json"])
    assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")).version, VERSION, f);
  const market = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude-plugin/marketplace.json"), "utf8"));
  assert.ok(market.plugins.every(p => p.version === VERSION), "marketplace.json");
  assert.match(fs.readFileSync(path.join(ROOT, "README.md"), "utf8"), new RegExp(`^Version ${VERSION.replace(/\./g, "\\.")}\\.`, "m"));
  // no manifest still names the old release
  for (const f of [".claude-plugin/plugin.json", ".claude-plugin/marketplace.json", ".codex-plugin/plugin.json", ".cursor-plugin/plugin.json"])
    assert.ok(!fs.readFileSync(path.join(ROOT, f), "utf8").includes("0.6.0"), f);
});
