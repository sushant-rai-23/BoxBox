// Tests for the page checker's reliability rules: references into the repo (file:line, quotes,
// test names, commits), evidence labels on claims, and facts read from git and the pit wall.
// Run: node --test tests/pitwall/*.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { checkPage } = require("../../skills/boxbox-setup/kit/pitwall/check-page.js");

// A small git repo with fixed dates (so hashes are stable), a .boxbox folder and a one-template kit.
function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "boxbox-facts-"));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(root, ".nogit"), GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@example.com", GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z" };
  const git = (...a) => execFileSync("git", ["-c", "commit.gpgsign=false", ...a], { cwd: root, env, encoding: "utf8" }).trim();
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  git("init", "-q", "-b", "main");
  write("app/tokens.py", "import secrets\n\n\ndef new_token():\n    return secrets.token_hex(32)\n");
  write("tests/test_tokens.py", "from app.tokens import new_token\n\n\ndef test_token_is_64_hex():\n    assert len(new_token()) == 64\n");
  git("add", "-A"); git("commit", "-q", "-m", "first");
  const first = git("rev-parse", "HEAD");
  git("checkout", "-q", "-b", "feature-x");
  write("app/tokens.py", "import secrets\n\n\ndef new_token():\n    return secrets.token_hex(32)\n\n\ndef short_token():\n    return secrets.token_hex(8)\n");
  git("add", "-A"); git("commit", "-q", "-m", "second");
  const second = git("rev-parse", "HEAD");

  const box = path.join(root, ".boxbox");
  const t = path.join(box, "templates");
  fs.mkdirSync(t, { recursive: true });
  fs.mkdirSync(path.join(box, "assets"));
  fs.writeFileSync(path.join(box, "assets", "boxbox.css"), "");
  fs.writeFileSync(path.join(box, "assets", "boxbox.js"), "");
  fs.writeFileSync(path.join(t, "_components.html"), `<div class="article"><figure class="code"></figure><ul class="changes"><li class="change"><span class="delta"></span></li></ul><dl class="metrics"><dd class="metric"></dd></dl><span class="status"></span><aside class="callout"></aside><ol class="path"><li><span class="at"></span></li></ol><b class="pin"></b><div class="table"></div></div>`);
  fs.writeFileSync(path.join(t, "report.html"), `<meta name="boxbox-page" content="report"><article class="article">
<section data-section="exists" data-required="yes" data-min-words="0" id="exists"><h2>x</h2></section>
<section data-section="verify" data-required="yes" data-min-words="0" data-min-items="3" data-max-items="3" id="verify"><h2>x</h2></section>
<section data-section="extra" data-required="no" data-min-words="0" id="extra"><h2>x</h2></section></article>`);
  fs.writeFileSync(path.join(t, "knowledge.html"), `<meta name="boxbox-page" content="knowledge"><article class="article">
<section data-section="how" data-required="yes" data-min-words="0" id="how"><h2>x</h2></section>
<section data-section="idea" data-required="yes" data-min-words="0" id="idea"><h2>x</h2></section></article>`);
  fs.mkdirSync(path.join(box, "f"), { recursive: true });
  return { root, box, first, second, git, templates: t };
}

const VERIFY = `<section data-section="verify" data-required="yes" id="verify"><h2>Verify these yourself</h2><aside class="callout" data-kind="verify"><ol data-evidence="code"><li>a</li><li>b</li><li>c</li></ol></aside></section>`;
function page(r, body, { kind = "report", attrs = "" } = {}) {
  return `<!doctype html><html><head><meta name="boxbox-page" content="${kind}"><title>t</title></head><body><article class="article"${attrs}>
<section data-section="${kind === "report" ? "exists" : "how"}" data-required="yes" id="main"><h2>Main</h2>
${body}
</section>${kind === "report" ? VERIFY : `<section data-section="idea" data-required="yes" id="idea"><h2>Idea</h2><p>An analogy needs no label here.</p></section>`}</article></body></html>`;
}
function check(r, html, name = "page.html") {
  const file = path.join(r.box, "f", name);
  fs.writeFileSync(file, html);
  return checkPage(html, { file, templatesDir: r.templates }).map(p => p.msg);
}

/* ---------------- 2. references into the repo ---------------- */

test("a file:line reference must point at a line that exists, at the page's commit", () => {
  const r = makeRepo();
  assert.deepEqual(check(r, page(r, `<p data-evidence="code">See <code>app/tokens.py:9</code>.</p>`)), [], "line 9 exists at HEAD");
  assert.match(check(r, page(r, `<p data-evidence="code">See <code>app/tokens.py:40</code>.</p>`)).join("\n"), /app\/tokens\.py:40: the file has 9 lines at /);
  assert.match(check(r, page(r, `<p data-evidence="code">See <code>app/tokens.py:9</code>.</p>`, { attrs: ` data-commit="${r.first.slice(0, 7)}"` })).join("\n"), /app\/tokens\.py:9: the file has 5 lines at /, "pinned to the first commit");
  assert.match(check(r, page(r, `<p data-evidence="code">See <code>app/nope.py:1</code>.</p>`)).join("\n"), /app\/nope\.py:1: no such file at /);
  assert.deepEqual(check(r, page(r, `<ol class="path" data-evidence="code"><li><b>x</b><span class="at">app/tokens.py:4-5</span></li></ol>`)), [], "span.at ranges are checked too");
});

test("a data-quote block must match the repo byte for byte, pins aside", () => {
  const r = makeRepo();
  const ok = `<figure class="code" data-evidence="code"><figcaption><code>app/tokens.py</code></figcaption><pre data-quote="app/tokens.py:4-5"><code>def new_token():<b class="pin">1</b>\n    return secrets.token_hex(32)</code></pre></figure>`;
  assert.deepEqual(check(r, page(r, ok)), []);
  const drifted = ok.replace("token_hex(32)", "token_hex(16)");
  assert.match(check(r, page(r, drifted)).join("\n"), /quote of app\/tokens\.py:4-5 does not match the repo at [0-9a-f]{7}: line 5 differs/);
  const pinned = ok.replace('data-quote="app/tokens.py:4-5"', `data-quote="app/tokens.py:8-9@${r.second.slice(0, 7)}"`).replace("def new_token():", "def short_token():").replace("token_hex(32)", "token_hex(8)");
  assert.deepEqual(check(r, page(r, pinned)), [], "a quote can pin its own commit");
  const entities = `<figure class="code" data-evidence="code"><pre data-quote="tests/test_tokens.py:5"><code>    assert len(new_token()) == 64</code></pre></figure>`;
  assert.deepEqual(check(r, page(r, entities)), []);
});

test("code captioned with a repo file must be quoted exactly", () => {
  const r = makeRepo();
  const loose = `<figure class="code" data-evidence="code"><figcaption><code>app/tokens.py</code></figcaption><pre><code>def new_token(): ...</code></pre></figure>`;
  assert.match(check(r, page(r, loose)).join("\n"), /code from app\/tokens\.py is not marked data-quote/);
});

test("proposed code for an existing file is marked data-new and needs no quote", () => {
  const r = makeRepo();
  const proposed = `<figure class="code" data-evidence="inferred" data-new><figcaption><code>app/tokens.py</code></figcaption><pre><code>def rate_key(ip): ...</code></pre></figure>`;
  assert.deepEqual(check(r, page(r, proposed)), []);
});

test("a test name must exist in a test file", () => {
  const r = makeRepo();
  assert.deepEqual(check(r, page(r, `<p data-evidence="code"><code data-test>test_token_is_64_hex</code> pins the length.</p>`)), []);
  assert.match(check(r, page(r, `<p data-evidence="code"><code data-test>test_token_is_random</code> proves it.</p>`)).join("\n"), /test "test_token_is_random" is not in any test file/);
});

test("check-page: a report brief quote must match the brief file", () => {
  const r = makeRepo();
  fs.mkdirSync(path.join(r.box, "f", "e1-x", "tasks"), { recursive: true });
  fs.writeFileSync(path.join(r.box, "f", "e1-x", "tasks", "E1.1.md"), "# Brief: E1.1 short tokens\ntask: E1.1\n\n## Goal\nA short token is   16 hex characters. Serves: tokens.\n");
  const q = (p, t) => page(r, `<p data-evidence="code">Goal: <q data-brief="${p}">${t}</q></p>`);
  assert.deepEqual(check(r, q("f/e1-x/tasks/E1.1.md", "A short token is 16 hex characters.")), [], "whitespace is normalised; a part of the goal is enough");
  assert.match(check(r, q("f/e1-x/tasks/E1.1.md", "A short token is 32 hex characters.")).join("\n"), /does not match the brief f\/e1-x\/tasks\/E1\.1\.md/);
  assert.match(check(r, q("f/e1-x/tasks/E1.9.md", "anything")).join("\n"), /brief f\/e1-x\/tasks\/E1\.9\.md: no such file/);
  assert.match(check(r, q("../outside.md", "anything")).join("\n"), /data-brief="\.\.\/outside\.md" must be a path inside \.boxbox/);
});

test("a commit hash must exist; a branch must exist", () => {
  const r = makeRepo();
  assert.deepEqual(check(r, page(r, `<p data-evidence="code">In <code data-source="git:commit">${r.first.slice(0, 7)}</code> on <code data-source="git:branch">feature-x</code>.</p>`)), []);
  const bad = check(r, page(r, `<p data-evidence="code">In <code data-source="git:commit">deadbee</code> on <code data-source="git:branch">nope</code>.</p>`)).join("\n");
  assert.match(bad, /commit deadbee does not exist/);
  assert.match(bad, /branch "nope" does not exist/);
});

test("reference checks say so plainly when the page is not in a git repository", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boxbox-nogit-"));
  const r = makeRepo();
  const file = path.join(dir, "page.html");
  const html = page(r, `<p data-evidence="code">See <code>app/tokens.py:1</code>.</p>`);
  fs.writeFileSync(file, html);
  assert.match(checkPage(html, { file, templatesDir: r.templates }).map(p => p.msg).join("\n"), /not inside a git repository/);
});

/* ---------------- 3. evidence labels ---------------- */

test("every block in a required section of a report needs an evidence label, on itself or its list, table or figure", () => {
  const r = makeRepo();
  const msgs = check(r, page(r, `<p>An unlabelled claim.</p><ul><li>one</li></ul><div class="table"><table><thead><tr><th>h</th></tr></thead><tbody><tr><td>row</td></tr></tbody></table></div>`)).join("\n");
  assert.match(msgs, /<p> in section "exists" has no evidence label/);
  assert.match(msgs, /<li> in section "exists" has no evidence label/);
  assert.match(msgs, /<tr> in section "exists" has no evidence label/);
  assert.ok(!/<th>|thead/.test(msgs), "header rows are not claims");
  const covered = `<p data-evidence="observed">Seen running.</p><ul data-evidence="code"><li>one</li><li>two</li></ul><div class="table" data-evidence="inferred"><table><tbody><tr><td>row</td></tr></tbody></table></div>`;
  assert.deepEqual(check(r, page(r, covered)), []);
});

test("a labelled list item covers the paragraph inside it; an unlabelled one is reported once", () => {
  const r = makeRepo();
  assert.deepEqual(check(r, page(r, `<ul><li data-evidence="inferred"><b>Risk</b><p>Why it matters.</p></li><li data-evidence="code"><b>Other</b><p>Detail.</p></li></ul>`)), []);
  const msgs = check(r, page(r, `<ul><li><b>Risk</b><p>Why it matters.</p></li></ul>`));
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /<li> in section "exists" has no evidence label/);
});

test("a section label does not cover its blocks, and only the five labels exist", () => {
  const r = makeRepo();
  const html = page(r, `<p>Claim.</p>`).replace('id="main"', 'id="main" data-evidence="code"');
  assert.match(check(r, html).join("\n"), /<p> in section "exists" has no evidence label/);
  assert.match(check(r, page(r, `<p data-evidence="probably">Claim.</p>`)).join("\n"), /data-evidence="probably" is not one of observed, code, inferred, unknown, source/);
});

test("'unknown' is a valid answer; a 'source' label needs a link to the source", () => {
  const r = makeRepo();
  assert.deepEqual(check(r, page(r, `<p data-evidence="unknown">Nobody measured the response time.</p>`)), []);
  assert.match(check(r, page(r, `<p data-evidence="source">SHA-256 has no known preimage attack.</p>`)).join("\n"), /data-evidence="source" needs a link to the source/);
  assert.deepEqual(check(r, page(r, `<p data-evidence="source">See <a href="https://csrc.nist.gov/pubs/fips/180-4/upd1/final">FIPS 180-4</a>.</p>`)), []);
});

test("knowledge pages: claims not about this repo need a source, and 'inferred' is not enough", () => {
  const r = makeRepo();
  const k = (body) => check(r, page(r, body, { kind: "knowledge" }), "k.html");
  assert.match(k(`<p>Unlabelled.</p>`).join("\n"), /<p> in section "how" has no evidence label/);
  assert.match(k(`<p data-evidence="inferred">Guess.</p>`).join("\n"), /on a knowledge page, label a claim "source" with a link, or "code" or "observed" if it is about this repo/);
  assert.deepEqual(k(`<p data-evidence="code">In this repo, <code>app/tokens.py:5</code> makes one.</p>`), []);
});

test("the verify box holds exactly three claims", () => {
  const r = makeRepo();
  const four = page(r, `<p data-evidence="code">x</p>`).replace("<li>c</li>", "<li>c</li><li>d</li>");
  assert.match(check(r, four).join("\n"), /section "verify" has 4 list items; it needs at most 3/);
});

/* ---------------- 1. facts from git and the pit wall ---------------- */

test("diff counts and commit counts come from git for the page's range", () => {
  const r = makeRepo();
  const range = ` data-range="${r.first.slice(0, 7)}..${r.second.slice(0, 7)}"`;
  const good = `<ul class="changes" data-evidence="code"${range}><li class="change"><code>app/tokens.py</code><span class="delta" data-source="git:diff" data-file="app/tokens.py"><ins>+4</ins><del>−0</del></span></li></ul>
<dl class="metrics"${range}><div><dt>commits</dt><dd class="metric" data-source="git:commits">1</dd></div></dl>`;
  assert.deepEqual(check(r, page(r, good)), []);
  const bad = check(r, page(r, good.replace("<ins>+4</ins>", "<ins>+41</ins>").replace(">1</dd>", ">5</dd>"))).join("\n");
  assert.match(bad, /app\/tokens\.py changed \+4 −0 in [0-9a-f]{7}\.\.[0-9a-f]{7}, the page says \+41 −0/);
  assert.match(bad, /1 commit in [0-9a-f]{7}\.\.[0-9a-f]{7}, the page says 5/);
});

test("a fact's own data-range wins over the page's", () => {
  const r = makeRepo();
  const own = `<p data-evidence="code"><span class="delta" data-source="git:diff" data-file="app/tokens.py" data-range="${r.first.slice(0, 7)}..${r.first.slice(0, 7)}"><ins>+0</ins><del>−0</del></span></p>`;
  assert.deepEqual(check(r, page(r, own, { attrs: ` data-range="${r.first.slice(0, 7)}..${r.second.slice(0, 7)}"` })), []);
});

test("test results and task verification come from the pit wall's observed data", () => {
  const r = makeRepo();
  const live = path.join(r.box, "live");
  fs.mkdirSync(live);
  const ev = (o) => JSON.stringify({ lane: "driver", ...o });
  fs.writeFileSync(path.join(live, "events.jsonl"), [
    ev({ ts: "2026-01-01T10:00:00Z", type: "action", kind: "edit", target: "app/tokens.py", unit: "E1.1", edits: ["app/tokens.py"] }),
    ev({ ts: "2026-01-01T10:05:00Z", type: "action", kind: "test", target: "pytest", unit: "E1.1", test: { status: "pass", observed: true, passed: 13, failed: 0 } }),
    ev({ ts: "2026-01-01T10:20:00Z", type: "action", kind: "edit", target: "app/tokens.py", unit: "E1.2", edits: ["app/tokens.py"] })
  ].join("\n") + "\n");
  fs.writeFileSync(path.join(r.box, "board-data.js"), `window.BOXBOX_BOARD = ${JSON.stringify({ project: "x", updated: "2026-01-01", milestones: [{ id: "M1", title: "m", status: "in_progress", epics: [{ id: "E1", title: "e", status: "in_progress", tasks: [{ id: "E1.1", title: "a", status: "done" }, { id: "E1.2", title: "b", status: "done" }] }] }] })};\n`);
  const good = `<dl class="metrics" data-unit="E1"><div><dt>tests</dt><dd class="metric" data-source="pitwall:tests">13<small>/13</small></dd></div></dl>
<p data-evidence="observed"><span class="status" data-source="pitwall:task" data-task="E1.1">verified</span> <span class="status" data-source="pitwall:task" data-task="E1.2">claimed</span></p>`;
  assert.deepEqual(check(r, page(r, good)), []);
  const bad = check(r, page(r, good.replace("13<small>/13</small>", "14<small>/14</small>").replace(">claimed<", ">verified<"))).join("\n");
  assert.match(bad, /the pit wall's last observed test run for E1 was 13\/13, the page says 14\/14/);
  assert.match(bad, /E1\.2 is claimed in the pit wall's data \(no passing run seen after its last edit\), the page says verified/);
});

test("with no pit wall data, a fact must say 'not recorded'", () => {
  const r = makeRepo();
  const html = (v) => page(r, `<dl class="metrics" data-unit="E1"><div><dt>tokens</dt><dd class="metric" data-source="pitwall:tokens">${v}</dd></div></dl>`);
  assert.match(check(r, html("950k")).join("\n"), /no pit wall data for tokens on E1, the page says 950k: write "not recorded"/);
  assert.deepEqual(check(r, html("not recorded")), []);
});
