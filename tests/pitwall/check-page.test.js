// Tests for skills/boxbox-setup/kit/pitwall/check-page.js, the page checker.
// Run: node --test tests/pitwall/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { checkPage } = require("../../skills/boxbox-setup/kit/pitwall/check-page.js");

const CHECKER = path.join(__dirname, "..", "..", "skills", "boxbox-setup", "kit", "pitwall", "check-page.js");

// A tiny kit: one template with one required and one optional section, and a gallery.
function makeKit() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boxbox-check-"));
  const t = path.join(dir, "templates");
  fs.mkdirSync(t);
  fs.mkdirSync(path.join(dir, "assets"));
  fs.writeFileSync(path.join(dir, "assets", "boxbox.css"), "");
  fs.writeFileSync(path.join(dir, "assets", "boxbox.js"), "");
  fs.writeFileSync(path.join(t, "_components.html"), `<div class="doc"><p class="lede"></p><aside class="callout"></aside><span class="status"></span></div>`);
  fs.writeFileSync(path.join(t, "report.html"), `<!doctype html><html><head><meta name="boxbox-page" content="report">
<link rel="stylesheet" href="{{ROOT}}assets/boxbox.css"><title>{{TITLE}}</title></head><body>
<section data-section="exists" data-required="yes" data-min-words="10" id="exists"><h2>What exists</h2><p>{{What now exists, in plain words}}</p></section>
<section data-section="extra" data-required="no" data-min-words="5" id="extra"><h2>Extra</h2><p>{{Optional}}</p></section>
<script src="{{ROOT}}assets/boxbox.js"></script></body></html>`);
  return dir;
}

const GOOD = `<!doctype html><html><head><meta name="boxbox-page" content="report">
<link rel="stylesheet" href="assets/boxbox.css"><title>E1 report</title></head><body>
<div class="doc"><p class="lede">Lede.</p>
<section data-section="exists" data-required="yes" data-min-words="10" id="exists"><h2>What exists</h2>
<p data-evidence="code">A known email now gets a one-time reset link, and an unknown one gets the same answer.</p>
<pre><code>const x = "{{ handlebars in real code is fine }}";</code></pre>
<p data-evidence="inferred">See <a href="#exists">above</a>.</p></section>
</div>
<script src="assets/boxbox.js"></script></body></html>`;

function run(html, kit) {
  const file = path.join(kit, "page.html");
  fs.writeFileSync(file, html);
  return checkPage(html, { file, templatesDir: path.join(kit, "templates") }).map(p => p.msg);
}

test("a filled page with only gallery classes passes", () => {
  const kit = makeKit();
  assert.deepEqual(run(GOOD, kit), []);
});

test("leftover template placeholders fail, double braces in real code do not", () => {
  const kit = makeKit();
  const msgs = run(GOOD.replace("Lede.", "{{TITLE}}"), kit);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /placeholder \{\{TITLE\}\}/);
  const inCode = run(GOOD.replace("handlebars in real code is fine", "What now exists, in plain words"), kit);
  assert.match(inCode.join("\n"), /placeholder \{\{What now exists, in plain words\}\}/, "a template placeholder left inside code still counts");
});

test("a style block or an inline style fails", () => {
  const kit = makeKit();
  assert.match(run(GOOD.replace("</head>", "<style>p{color:red}</style></head>"), kit).join("\n"), /<style> block/);
  assert.match(run(GOOD.replace('<p class="lede">', '<p class="lede" style="color:red">'), kit).join("\n"), /inline style= on <p>/);
});

test("escaped markup inside code is not mistaken for a real attribute", () => {
  const kit = makeKit();
  assert.deepEqual(run(GOOD.replace("const x", "&lt;div style=\"a\" class=\"nope\"&gt; const x"), kit), []);
});

test("a class that is not in the gallery fails", () => {
  const kit = makeKit();
  const msgs = run(GOOD.replace('class="lede"', 'class="lede fancy-card"'), kit);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /class "fancy-card" on <p> is not in the component gallery/);
});

test("a missing required section fails, a missing optional one does not", () => {
  const kit = makeKit();
  const msgs = run(GOOD.replace(/<section[\s\S]*<\/section>/, ""), kit);
  assert.match(msgs.join("\n"), /required section "exists" is missing/);
  assert.ok(!msgs.join("\n").includes('"extra"'));
});

test("a required section below its minimum length fails, using the template's minimum", () => {
  const kit = makeKit();
  const short = GOOD.replace("A known email now gets a one-time reset link, and an unknown one gets the same answer.", "Done.")
    .replace('data-min-words="10"', 'data-min-words="1"');
  const msgs = run(short, kit);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /section "exists" has \d+ words of prose; it needs at least 10/);
});

test("code blocks do not count toward a section's length", () => {
  const kit = makeKit();
  const padded = GOOD.replace("A known email now gets a one-time reset link, and an unknown one gets the same answer.", "Short.")
    .replace("const x =", "one two three four five six seven eight nine ten eleven twelve const x =");
  assert.match(run(padded, kit).join("\n"), /section "exists" has/);
});

test("links to pages that do not exist fail, as do anchors with no target", () => {
  const kit = makeKit();
  const msgs = run(GOOD.replace('href="#exists"', 'href="plan.html"').replace("</section>", '<a href="#nowhere">x</a></section>'), kit);
  assert.match(msgs.join("\n"), /link to plan\.html: no such file/);
  assert.match(msgs.join("\n"), /link to #nowhere: no element has id="nowhere"/);
  fs.writeFileSync(path.join(kit, "plan.html"), "");
  assert.ok(!run(GOOD.replace('href="#exists"', 'href="plan.html"'), kit).join("\n").includes("plan.html"), "an existing page passes");
});

test("external links, the pit wall link and mail links are not checked", () => {
  const kit = makeKit();
  const html = GOOD.replace('href="#exists"', 'href="https://github.com/x/y/pull/41"').replace("</section>", '<a href="/">Pit wall</a><a href="mailto:a@b.c">m</a></section>');
  assert.deepEqual(run(html, kit), []);
});

test("a diagram needs role=img and a label; images need alt text", () => {
  const kit = makeKit();
  const bare = run(GOOD.replace("</section>", '<svg viewBox="0 0 10 10"><rect width="1" height="1"/></svg></section>'), kit);
  assert.match(bare.join("\n"), /<svg> has no text alternative/);
  const labelled = run(GOOD.replace("</section>", '<svg viewBox="0 0 10 10" role="img" aria-label="A box"><rect width="1" height="1"/></svg></section>'), kit);
  assert.deepEqual(labelled, []);
  const hidden = run(GOOD.replace("</section>", '<svg aria-hidden="true"><path d="M0 0"/></svg></section>'), kit);
  assert.deepEqual(hidden, [], "decorative svg marked aria-hidden is fine");
  assert.match(run(GOOD.replace("</section>", '<img src="assets/boxbox.css"></section>'), kit).join("\n"), /<img> has no alt text/);
});

test("a page without the 0.6 page marker is reported, not crashed on", () => {
  const kit = makeKit();
  const msgs = run(GOOD.replace('<meta name="boxbox-page" content="report">', ""), kit);
  assert.match(msgs.join("\n"), /no <meta name="boxbox-page">/);
});

test("extra scripts and stylesheets fail", () => {
  const kit = makeKit();
  assert.match(run(GOOD.replace("</body>", "<script>alert(1)</script></body>"), kit).join("\n"), /<script> other than assets\/boxbox\.js/);
  assert.match(run(GOOD.replace("</head>", '<link rel="stylesheet" href="https://cdn.example/x.css"></head>'), kit).join("\n"), /stylesheet other than/);
});

test("problems carry the line they were found on", () => {
  const kit = makeKit();
  const file = path.join(kit, "page.html");
  const html = GOOD.replace('<p class="lede">', '<p class="lede wat">');
  fs.writeFileSync(file, html);
  const [p] = checkPage(html, { file, templatesDir: path.join(kit, "templates") });
  assert.equal(p.line, 3);
});

test("the command line prints problems and exits 1, and exits 0 when clean", () => {
  const kit = makeKit();
  const good = path.join(kit, "good.html"), bad = path.join(kit, "bad.html");
  fs.writeFileSync(good, GOOD);
  fs.writeFileSync(bad, GOOD.replace("Lede.", "{{TITLE}}").replace('class="lede"', 'class="lede wat"'));
  const ok = spawnSync(process.execPath, [CHECKER, "--templates", path.join(kit, "templates"), good], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /good\.html: OK/);
  const no = spawnSync(process.execPath, [CHECKER, "--templates", path.join(kit, "templates"), bad], { encoding: "utf8" });
  assert.equal(no.status, 1);
  assert.match(no.stdout, /bad\.html: 2 problems/);
  assert.match(no.stdout, /line 3: leftover placeholder \{\{TITLE\}\}/);
});

test("writing that reads as AI-made fails: middle-dot lines, appended arrows, 'should work'", () => {
  const kit = makeKit();
  assert.match(run(GOOD.replace("Lede.", "Password reset · E1 · 14 Oct"), kit).join("\n"), /middle dots/);
  assert.match(run(GOOD.replace(">above<", ">Read the plan →<"), kit).join("\n"), /arrow/);
  assert.match(run(GOOD.replace("Lede.", "This should work now."), kit).join("\n"), /should work/);
  const inCode = GOOD.replace("const x =", "// a · b → c should work\nconst x =");
  assert.deepEqual(run(inCode, kit), [], "code is quoted as it is");
});

test("a link to an anchor on another page fails when that page has no such id", () => {
  const kit = makeKit();
  fs.writeFileSync(path.join(kit, "plan.html"), '<section id="e1"></section>');
  assert.deepEqual(run(GOOD.replace('href="#exists"', 'href="plan.html#e1"'), kit), []);
  assert.match(run(GOOD.replace('href="#exists"', 'href="plan.html#e2"'), kit).join("\n"), /plan\.html#e2: plan\.html has no id="e2"/);
});

test("a section can require a number of items and a diagram, read from the template", () => {
  const kit = makeKit();
  const t = path.join(kit, "templates", "report.html");
  fs.writeFileSync(t, fs.readFileSync(t, "utf8").replace('data-min-words="10" id="exists"', 'data-min-words="10" data-min-items="2" data-needs="svg" id="exists"'));
  const msgs = run(GOOD, kit).join("\n");
  assert.match(msgs, /section "exists" has 0 list items; it needs at least 2/);
  assert.match(msgs, /section "exists" needs a diagram/);
  const full = GOOD.replace("</section>", '<ul data-evidence="code"><li>one</li><li>two</li></ul><figure><svg role="img" aria-label="x"></svg></figure></section>');
  assert.deepEqual(run(full, kit), []);
});

/* ---------- the real kit: templates and gallery ---------- */
const KIT = path.join(__dirname, "..", "..", "skills", "boxbox-setup", "kit");
const { tokenize } = require("../../skills/boxbox-setup/kit/pitwall/check-page.js");
const KINDS = ["context", "decisions", "plan", "design", "report", "knowledge", "explain", "review"];

test("every template is a 0.6 page that uses only gallery classes and sets a minimum on each required section", () => {
  const allowed = new Set();
  for (const t of tokenize(fs.readFileSync(path.join(KIT, "templates", "_components.html"), "utf8"))) if (t.type === "open" && t.attrs.class) t.attrs.class.split(/\s+/).forEach(c => allowed.add(c));
  for (const kind of KINDS) {
    const html = fs.readFileSync(path.join(KIT, "templates", kind + ".html"), "utf8");
    const toks = tokenize(html);
    assert.ok(toks.some(t => t.type === "open" && t.name === "meta" && t.attrs.name === "boxbox-page" && t.attrs.content === kind), `${kind}: page marker`);
    for (const t of toks) if (t.type === "open" && t.attrs.class) for (const c of t.attrs.class.split(/\s+/)) assert.ok(allowed.has(c), `${kind}: class "${c}" not in the gallery`);
    const required = toks.filter(t => t.type === "open" && t.name === "section" && t.attrs["data-required"] === "yes");
    assert.ok(required.length >= 1, `${kind}: has required sections`);
    for (const s of required) assert.ok(Number(s.attrs["data-min-words"]) > 0, `${kind}: section ${s.attrs["data-section"]} sets data-min-words`);
    assert.ok(!/assets\/(style\.css|page\.js)/.test(html), `${kind}: loads the 0.6 assets only`);
    assert.ok(!/<style|\sstyle=/.test(html.replace(/<!--[\s\S]*?-->/g, "")), `${kind}: no CSS of its own`);
  }
});
