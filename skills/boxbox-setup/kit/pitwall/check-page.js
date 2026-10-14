#!/usr/bin/env node
// Boxbox page checker. Plain Node, no dependencies. Reads files and runs read-only git commands.
//
//   node .boxbox/pitwall/check-page.js <page.html> [more pages]
//
// A page made from a Boxbox template must:
//   shape
//   - fill every template placeholder ({{...}})
//   - add no <style> block and no style= attribute, and load no other script or stylesheet
//   - use only classes from templates/_components.html
//   - keep every section its template marks data-required="yes", with at least its data-min-words of
//     prose (code and diagrams do not count), its data-min-items / data-max-items list items, and a
//     diagram where it says data-needs="svg"
//   - give every diagram a text alternative, and link only to pages and anchors that exist
//   - avoid writing that reads as machine-made: lines joined with middle dots, arrows, "should work"
//   references, checked against the repo at the page's commit (data-commit, default HEAD)
//   - every file:line in <code> or span.at points at a line that exists
//   - every <pre data-quote="path:first-last[@commit]"> matches those lines byte for byte (pins aside),
//     and code captioned with a repo file is quoted that way
//   - every <code data-test> names a test that exists in a test file
//   - every <q data-brief="<path under .boxbox>"> quotes text that is in that task brief
//   evidence
//   - in the required sections of report, context, review and explain pages, every paragraph, list item,
//     table row and definition carries data-evidence (observed | code | inferred | unknown | source), on
//     itself or on its list, table, figure or aside; "source" needs a link to the source
//   - on knowledge pages, every claim is "source" with a link, or "code" / "observed" about this repo
//   facts, read from git and the pit wall's own data (data-source)
//   - git:commit and git:branch exist; git:diff and git:commits match the page's data-range
//   - pitwall:tests, pitwall:task, pitwall:tokens, pitwall:cost, pitwall:time match the recorded data
// Exit code 0 when every page passes, 1 when any page has a problem, 2 on a usage error.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const PROSE_SKIP = new Set(["pre", "svg", "script", "style"]);
const EVIDENCE = ["observed", "code", "inferred", "unknown", "source"];
const EVIDENCE_PAGES = new Set(["report", "context", "review", "explain"]);
const KNOWLEDGE_FREE = new Set(["idea", "check", "reading", "unchecked"]); // knowledge sections with no labels needed
const CLAIM_TAGS = new Set(["p", "li", "tr", "dd"]);
const COVER_TAGS = new Set(["ul", "ol", "dl", "table", "figure", "aside"]);
const REF = /^([A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?$/;
const PATHLIKE = /^[A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+$/;
const TEST_FILE = /(^|\/)(tests?|spec|__tests__)\/|(^|\/)test_[^/]*$|_test\.[a-z]+$|\.(test|spec)\.[a-z]+$/;

/* ---------- a small tokenizer: enough for pages written from our templates ---------- */
function tokenize(html) {
  const out = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|[^<]+|</g;
  let m, line = 1, last = 0;
  while ((m = re.exec(html))) {
    for (let i = last; i < m.index; i++) if (html.charCodeAt(i) === 10) line++;
    last = m.index;
    const at = line;
    if (m[0].startsWith("<!--")) out.push({ type: "comment", line: at });
    else if (m[2]) {
      const name = m[2].toLowerCase(), raw = m[3] || "";
      out.push({ type: m[1] ? "close" : "open", name, attrs: m[1] ? {} : parseAttrs(raw), self: /\/\s*$/.test(raw), line: at });
    } else out.push({ type: "text", text: m[0], line: at });
  }
  return out;
}
function parseAttrs(raw) {
  const attrs = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
  let m;
  while ((m = re.exec(raw))) {
    let v = m[2] == null ? "" : m[2];
    if (/^["']/.test(v)) v = v.slice(1, -1);
    attrs[m[1].toLowerCase()] = v;
  }
  return attrs;
}
const decode = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const words = s => (decode(s).match(/[A-Za-z0-9][\w'’.-]*/g) || []).length;
const placeholders = s => (s.match(/\{\{[^{}]*\}\}/g) || []).map(p => "{{" + p.slice(2, -2).trim() + "}}");
const classOf = a => (a.class || "").split(/\s+/).filter(Boolean);
const squash = s => decode(s).replace(/−/g, "-").replace(/\s+/g, "");
const short = h => (h || "").slice(0, 7);
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function classesIn(html) {
  const set = new Set();
  for (const t of tokenize(html)) if (t.type === "open" && t.attrs.class) for (const c of t.attrs.class.split(/\s+/)) if (c) set.add(c);
  return set;
}

// The template's sections: name -> { required, min, items, maxItems, svg }.
function sectionsIn(html) {
  const map = new Map();
  for (const t of tokenize(html)) {
    if (t.type !== "open" || t.name !== "section" || !t.attrs["data-section"]) continue;
    const a = t.attrs;
    map.set(a["data-section"], { required: a["data-required"] === "yes", min: Number(a["data-min-words"]) || 0, items: Number(a["data-min-items"]) || 0, maxItems: Number(a["data-max-items"]) || 0, svg: a["data-needs"] === "svg" });
  }
  return map;
}

function loadKit(templatesDir) {
  const kit = { dir: templatesDir, allowed: null, templates: new Map(), error: null };
  try { kit.allowed = classesIn(fs.readFileSync(path.join(templatesDir, "_components.html"), "utf8")); }
  catch { kit.error = `cannot read ${path.join(templatesDir, "_components.html")}; refresh the kit (see the boxbox-setup skill)`; }
  return kit;
}
function templateFor(kit, kind) {
  if (!kit.templates.has(kind)) {
    let t = null;
    try {
      const html = fs.readFileSync(path.join(kit.dir, kind + ".html"), "utf8");
      t = { sections: sectionsIn(html), placeholders: new Set(placeholders(html).filter(p => p !== "{{ROOT}}")) };
    } catch {}
    kit.templates.set(kind, t);
  }
  return kit.templates.get(kind);
}

/* ---------- the repo: read-only git, and the pit wall's recorded data ---------- */
function openRepo(file) {
  const dir = path.dirname(file);
  const run = (args, cwd) => execFileSync("git", args, { cwd: cwd || dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 });
  let root = null;
  try { root = run(["rev-parse", "--show-toplevel"]).trim(); } catch {}
  let box = null;
  for (let d = dir; d !== path.dirname(d); d = path.dirname(d)) if (path.basename(d) === ".boxbox") { box = d; break; }
  const cache = new Map();
  const memo = (k, f) => { if (!cache.has(k)) { let v; try { v = f(); } catch { v = null; } cache.set(k, v); } return cache.get(k); };
  const git = args => run(args, root);
  return {
    root, box,
    commit: ref => memo("c:" + ref, () => git(["rev-parse", "--verify", "--quiet", ref + "^{commit}"]).trim() || null),
    show: (c, p) => memo(`s:${c}:${p}`, () => git(["show", `${c}:${p}`])),
    branches: () => memo("branches", () => git(["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes"]).split("\n").filter(Boolean)),
    numstat: (range, p) => memo(`n:${range}:${p}`, () => { const l = git(["diff", "--numstat", range, "--", p]).trim(); if (!l) return { ins: 0, del: 0 }; const [a, b] = l.split("\t"); return { ins: Number(a), del: Number(b) }; }),
    count: range => memo("r:" + range, () => Number(git(["rev-list", "--count", range]).trim())),
    testFiles: c => memo("t:" + c, () => git(["ls-tree", "-r", "--name-only", c]).split("\n").filter(f => TEST_FILE.test(f))),
    // The pit wall's own view of .boxbox/live: the same code that draws the pit wall.
    live: () => memo("live", () => {
      if (!box || !fs.existsSync(path.join(box, "live", "events.jsonl"))) return null;
      const { Live } = require("./server.js");
      const l = new Live(box);
      const state = l.state();
      return { state, events: l.events };
    })
  };
}
function fmtTok(n) { n = n || 0; return n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n); }
function fmtMs(ms) { const m = Math.round((ms || 0) / 60000); return m < 1 ? "<1 min" : m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min"; }

/* ---------- the check ---------- */
function checkPage(html, opts) {
  const file = opts.file ? path.resolve(opts.file) : null;
  const kit = opts.kit || loadKit(opts.templatesDir || path.join(__dirname, "..", "templates"));
  const problems = [];
  const add = (line, msg) => problems.push({ line, msg });
  if (kit.error) { add(1, kit.error); return problems; }

  const toks = tokenize(html);
  const meta = toks.find(t => t.type === "open" && t.name === "meta" && t.attrs.name === "boxbox-page");
  const kind = meta && meta.attrs.content;
  const tpl = kind ? templateFor(kit, kind) : null;
  if (!kind) add(1, 'no <meta name="boxbox-page">: copy the page from a 0.6 template in .boxbox/templates/ instead of writing it by hand');
  else if (!tpl) add(meta.line, `no template named "${kind}" in ${kit.dir}`);

  let repoMemo;
  const repo = () => (repoMemo === undefined ? (repoMemo = file ? openRepo(file) : null) : repoMemo);
  let gitWarned = false;
  const needGit = line => {
    const r = repo();
    if (r && r.root) return r;
    if (!gitWarned) { gitWarned = true; add(line, "references and facts cannot be checked: this page is not inside a git repository"); }
    return null;
  };

  const ids = new Set(toks.filter(t => t.type === "open" && t.attrs.id).map(t => t.attrs.id));
  const stack = [];
  const sections = [];
  const seen = new Set();
  const once = (line, msg) => { const k = line + msg; if (!seen.has(k)) { seen.add(k); add(line, msg); } };
  const inside = name => stack.some(e => e.name === name);
  const prose = () => !stack.some(e => PROSE_SKIP.has(e.name));
  // An attribute on the element itself, else on its nearest ancestor.
  const near = (attr, own) => { if (own && own[attr] != null) return own[attr]; for (let i = stack.length - 1; i >= 0; i--) if (stack[i].attrs[attr] != null) return stack[i].attrs[attr]; return null; };
  const curSection = () => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].section) return stack[i]; return null; };
  const openCodeFigure = () => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].name === "figure" && stack[i].cls.includes("code")) return stack[i]; return null; };

  for (const t of toks) {
    if (t.type === "comment") continue;
    if (t.type === "text") {
      for (const p of placeholders(t.text)) {
        const inCode = inside("pre") || inside("code") || inside("script");
        if (!inCode || (tpl && tpl.placeholders.has(p))) once(t.line, `leftover placeholder ${p}`);
      }
      if (prose() && sections.length) { const n = words(t.text); for (const s of sections) s.words += n; }
      if (!inside("pre") && !inside("code") && !inside("script") && !inside("svg")) {
        const txt = decode(t.text);
        if (/\s·\s/.test(txt)) once(t.line, "a line joined with middle dots (·): write it as a sentence or a list");
        if (/→/.test(txt)) once(t.line, "an arrow (→) in the text: say in words where it leads");
        if (/\bshould work\b/i.test(txt)) once(t.line, '"should work": say what was verified, or say that it was not');
      }
      const inPin = stack.some(e => e.pin);
      for (const e of stack) if (e.capture && !(e.capture === "quote" && inPin)) e.text += t.text;
      const svgEl = stack.filter(e => e.svg).pop();
      if (svgEl && inside("title") && t.text.trim()) svgEl.svg.labelled = true;
      continue;
    }
    if (t.type === "close") {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].name !== t.name) continue;
        const closed = stack.splice(i);
        for (let j = closed.length - 1; j >= 0; j--) closeElement(closed[j]);
        break;
      }
      continue;
    }

    // an opening tag
    const a = t.attrs, cls = classOf(a);
    for (const v of Object.values(a)) for (const p of placeholders(v)) once(t.line, `leftover placeholder ${p}`);
    if (t.name === "style") once(t.line, "<style> block: pages add no CSS; use the components in templates/_components.html");
    if ("style" in a) once(t.line, `inline style= on <${t.name}>: pages add no CSS; use a component instead`);
    for (const c of cls) if (!kit.allowed.has(c)) once(t.line, `class "${c}" on <${t.name}> is not in the component gallery (templates/_components.html)`);
    if (a["data-evidence"] != null && !EVIDENCE.includes(a["data-evidence"]) && !placeholders(a["data-evidence"]).length) once(t.line, `data-evidence="${a["data-evidence"]}" is not one of ${EVIDENCE.join(", ")}`);

    if (t.name === "script") {
      if (!a.src || !/(^|\/)assets\/boxbox\.js$/.test(a.src)) once(t.line, "<script> other than assets/boxbox.js: pages add no scripts");
      else checkLocal(a.src, t.line, "script");
    }
    if (t.name === "link" && /\bstylesheet\b/.test(a.rel || "")) {
      if (/(^|\/)assets\/boxbox\.css$/.test(a.href || "")) checkLocal(a.href, t.line, "stylesheet");
      else if (!/^https:\/\/fonts\.googleapis\.com\//.test(a.href || "")) once(t.line, "stylesheet other than assets/boxbox.css and the template's fonts");
    }
    if (t.name === "a" && a.href != null) {
      checkLink(a.href, t.line);
      if (/^https?:\/\//i.test(a.href)) for (const e of stack) e.hasSource = true;
    }
    if (t.name === "img" && !(a.alt && a.alt.trim())) once(t.line, '<img> has no alt text: describe what it shows in alt="..."');
    if (t.name === "li") for (const s of sections) s.items++;
    if (t.name === "svg") for (const s of sections) s.svgs++;
    if (t.name === "pre" && a["data-quote"] != null) { const f = openCodeFigure(); if (f) f.quoted = true; }

    // evidence: is this block a claim that needs a label?
    const sec = curSection();
    let claim = null;
    if (sec && sec.evidence && CLAIM_TAGS.has(t.name) && !(t.name === "tr" && inside("thead"))) claim = checkEvidence(t, a, cls, sec);

    if (VOID.has(t.name) || t.self) continue;
    const el = { name: t.name, attrs: a, cls, line: t.line };
    if (claim) el.needSource = claim.needSource;
    if (t.name === "section" && a["data-section"] != null) {
      const name = a["data-section"], want = tpl && tpl.sections.get(name);
      el.section = { name, line: t.line, words: 0, items: 0, svgs: 0 };
      el.evidence = !!(want && want.required && (EVIDENCE_PAGES.has(kind) || (kind === "knowledge" && !KNOWLEDGE_FREE.has(name))));
      el.knowledge = kind === "knowledge";
      sections.push(el.section);
    }
    if (t.name === "svg") el.svg = { line: t.line, labelled: a["aria-hidden"] === "true" || (a.role === "img" && !!(a["aria-label"] || "").trim()) };
    if (t.name === "b" && cls.includes("pin")) el.pin = true;
    if (t.name === "pre" && a["data-quote"] != null) { el.capture = "quote"; el.text = ""; el.commit = near("data-commit", a); }
    else if (a["data-brief"] != null) { el.capture = "brief"; el.text = ""; }
    else if (a["data-source"] != null) { el.capture = "fact"; el.text = ""; el.range = near("data-range", a); el.unit = near("data-unit", a); }
    else if (t.name === "code" && a["data-test"] != null) { el.capture = "test"; el.text = ""; el.commit = near("data-commit", a); }
    else if ((t.name === "code" && !inside("pre")) || (t.name === "span" && cls.includes("at"))) {
      el.capture = "ref"; el.text = ""; el.commit = near("data-commit", a);
      el.caption = inside("figcaption") ? openCodeFigure() : null;
    }
    stack.push(el);
  }
  while (stack.length) closeElement(stack.pop());

  // required sections
  if (tpl) {
    const present = new Set(toks.filter(t => t.type === "open" && t.name === "section" && t.attrs["data-section"]).map(t => t.attrs["data-section"]));
    for (const [name, s] of tpl.sections) if (s.required && !present.has(name)) add(1, `required section "${name}" is missing: copy it back from templates/${kind}.html and fill it`);
  }
  problems.sort((x, y) => x.line - y.line);
  return problems;

  /* ---- helpers that close over the page ---- */
  function checkEvidence(t, a, cls, sec) {
    if (a["data-source"] != null) return null;
    let label = a["data-evidence"], from = label != null ? "self" : null;
    for (let i = stack.length - 1; i >= 0 && label == null; i--) {
      const e = stack[i];
      if (e === sec) break;
      if (e.attrs["data-source"] != null) return null;
      if (e.name === "nav" || (e.name === "ol" && e.cls.includes("checks")) || (e.name === "ul" && e.cls.includes("checklist"))) return null;
      // A block inside a list item, row or definition is part of that claim: its label covers it, and an
      // unlabelled one has already been reported.
      if (CLAIM_TAGS.has(e.name)) { if (e.attrs["data-evidence"] == null) return null; label = e.attrs["data-evidence"]; from = e; break; }
      if (e.attrs["data-evidence"] != null && (COVER_TAGS.has(e.name) || (e.name === "div" && e.cls.includes("table")))) { label = e.attrs["data-evidence"]; from = e; }
    }
    if (label == null) { once(t.line, `<${t.name}> in section "${sec.section.name}" has no evidence label: add data-evidence="${sec.knowledge ? "source | code | observed" : "observed | code | inferred | unknown | source"}" to it or to its list, table or figure`); return null; }
    if (sec.knowledge && (label === "inferred" || label === "unknown")) once(t.line, `<${t.name}> is labelled "${label}": on a knowledge page, label a claim "source" with a link, or "code" or "observed" if it is about this repo`);
    if (label === "source") { if (from === "self") return { needSource: true }; if (from) from.needSource = true; }
    return null;
  }
  function closeElement(e) {
    if (e.section) finishSection(sections.pop());
    if (e.svg && !e.svg.labelled) add(e.svg.line, '<svg> has no text alternative: add role="img" and aria-label="what the diagram shows", or aria-hidden="true" if it is decoration');
    if (e.needSource && !e.hasSource) once(e.line, 'data-evidence="source" needs a link to the source in the same block: <a href="https://...">');
    if (e.capture === "quote") checkQuote(e);
    else if (e.capture === "brief") checkBrief(e);
    else if (e.capture === "fact") checkFact(e);
    else if (e.capture === "test") checkTest(e);
    else if (e.capture === "ref") checkRef(e);
    if (e.name === "figure" && e.cls.includes("code") && e.captionFile && !e.quoted && e.attrs["data-new"] == null) once(e.line, `code from ${e.captionFile} is not marked data-quote: quote the exact lines with <pre data-quote="${e.captionFile}:<first>-<last>">, or drop the file name from the caption if the code is not from the repo`);
  }
  function finishSection(s) {
    if (!s || !tpl) return;
    const want = tpl.sections.get(s.name);
    if (!want) return;
    if (want.min && s.words < want.min) add(s.line, `section "${s.name}" has ${s.words} words of prose; it needs at least ${want.min}. Explain more of what is new to this developer (code blocks and diagrams do not count)`);
    if (want.items && s.items < want.items) add(s.line, `section "${s.name}" has ${s.items} list items; it needs at least ${want.items}`);
    if (want.maxItems && s.items > want.maxItems) add(s.line, `section "${s.name}" has ${s.items} list items; it needs at most ${want.maxItems}`);
    if (want.svg && !s.svgs) add(s.line, `section "${s.name}" needs a diagram: copy one from the Diagrams section of templates/_components.html`);
  }
  function commitOf(e, explicit) {
    const r = needGit(e.line);
    if (!r) return null;
    const ref = explicit || e.commit || "HEAD";
    const c = r.commit(ref);
    if (!c) { once(e.line, `commit ${ref} does not exist in this repository`); return null; }
    return { r, c };
  }
  function lines(text) { const l = text.split("\n"); if (l.length && l[l.length - 1] === "") l.pop(); return l; }
  function checkRef(e) {
    const text = decode(e.text).trim();
    if (e.caption && PATHLIKE.test(text)) {
      const r = repo();
      if (r && r.root && !e.caption.captionFile) { const c = r.commit(e.commit || "HEAD"); if (c && r.show(c, text) != null) e.caption.captionFile = text; }
      return;
    }
    const m = REF.exec(text);
    if (!m) return;
    const got = commitOf(e);
    if (!got) return;
    const body = got.r.show(got.c, m[1]);
    if (body == null) { once(e.line, `${text}: no such file at ${short(got.c)}`); return; }
    const n = lines(body).length, end = Number(m[3] || m[2]);
    if (end > n || Number(m[2]) < 1) once(e.line, `${text}: the file has ${n} lines at ${short(got.c)}`);
  }
  function checkQuote(e) {
    const spec = e.attrs["data-quote"];
    const m = /^([^:@]+):(\d+)(?:-(\d+))?(?:@([\w./-]+))?$/.exec(spec);
    if (!m) { once(e.line, `data-quote="${spec}" is not path:first-last (optionally @commit)`); return; }
    const got = commitOf(e, m[4]);
    if (!got) return;
    const body = got.r.show(got.c, m[1]);
    if (body == null) { once(e.line, `quote of ${m[1]}: no such file at ${short(got.c)}`); return; }
    const from = Number(m[2]), to = Number(m[3] || m[2]);
    const want = lines(body).slice(from - 1, to), have = lines(decode(e.text));
    const label = `${m[1]}:${from}${to !== from ? "-" + to : ""}`;
    if (have.length !== want.length) { once(e.line, `quote of ${label} has ${have.length} lines, the repo has ${want.length} at ${short(got.c)}`); return; }
    const i = have.findIndex((l, k) => l !== want[k]);
    if (i >= 0) once(e.line, `quote of ${label} does not match the repo at ${short(got.c)}: line ${from + i} differs. Copy it exactly, or quote a different range`);
  }
  // A task's goal quoted from its brief: <q data-brief="<path under .boxbox>">. Briefs stay uncommitted
  // while a unit is built, so the file is read from disk, not from git. Whitespace is normalised.
  function checkBrief(e) {
    const rel = e.attrs["data-brief"];
    if (!/^[\w.-]+(\/[\w.-]+)*\.md$/.test(rel) || rel.split("/").includes("..")) { once(e.line, `data-brief="${rel}" must be a path inside .boxbox, like <feature>/<unit>/tasks/<task id>.md`); return; }
    const r = repo();
    const box = r && r.box;
    if (!box) return;
    let body;
    try { body = fs.readFileSync(path.join(box, rel), "utf8"); } catch { once(e.line, `brief ${rel}: no such file in .boxbox`); return; }
    const norm = s => s.replace(/\s+/g, " ").trim();
    if (!norm(body).includes(norm(decode(e.text)))) once(e.line, `quote does not match the brief ${rel}: copy the goal from the brief exactly`);
  }
  function checkTest(e) {
    const name = decode(e.text).trim();
    const got = commitOf(e);
    if (!got) return;
    const re = new RegExp(`(^|[^\\w])${reEsc(name)}([^\\w]|$)`);
    const found = (got.r.testFiles(got.c) || []).some(f => re.test(got.r.show(got.c, f) || ""));
    if (!found) once(e.line, `test "${name}" is not in any test file at ${short(got.c)}`);
  }
  function rangeOf(e) {
    const r = needGit(e.line);
    if (!r) return null;
    if (!e.range) { once(e.line, `data-source="${e.attrs["data-source"]}" needs data-range="<before>..<last>" on it or on its list`); return null; }
    const [a, b] = e.range.split("..");
    const ca = r.commit(a), cb = r.commit(b);
    if (!ca || !cb) { once(e.line, `data-range="${e.range}": ${!ca ? a : b} is not a commit in this repository`); return null; }
    return { r, range: `${ca}..${cb}`, label: `${short(ca)}..${short(cb)}` };
  }
  function checkFact(e) {
    const src = e.attrs["data-source"], text = decode(e.text).trim(), flat = squash(e.text);
    if (src === "git:commit") {
      const r = needGit(e.line); if (!r) return;
      if (!/^[0-9a-f]{4,40}$/i.test(text) || !r.commit(text)) once(e.line, `commit ${text} does not exist in this repository`);
    } else if (src === "git:branch") {
      const r = needGit(e.line); if (!r) return;
      if (!(r.branches() || []).some(b => b === text || b.endsWith("/" + text))) once(e.line, `branch "${text}" does not exist in this repository`);
    } else if (src === "git:diff") {
      const g = rangeOf(e); if (!g) return;
      const f = e.attrs["data-file"];
      if (!f) { once(e.line, 'data-source="git:diff" needs data-file="<path>"'); return; }
      const ns = g.r.numstat(g.range, f);
      if (!ns) { once(e.line, `cannot read the diff of ${f} in ${g.label}`); return; }
      const ins = /\+(\d+)/.exec(flat), del = /-(\d+)/.exec(flat);
      const page = `+${ins ? ins[1] : "?"} −${del ? del[1] : "?"}`;
      if (!ins || !del || Number(ins[1]) !== ns.ins || Number(del[1]) !== ns.del) once(e.line, `${f} changed +${ns.ins} −${ns.del} in ${g.label}, the page says ${page}`);
    } else if (src === "git:commits") {
      const g = rangeOf(e); if (!g) return;
      const n = g.r.count(g.range);
      if (String(n) !== flat) once(e.line, `${n} commit${n === 1 ? "" : "s"} in ${g.label}, the page says ${text}`);
    } else if (/^pitwall:(tests|task|tokens|cost|time)$/.test(src)) checkPitwall(e, src.slice(8), text, flat);
    else once(e.line, `data-source="${src}" is not a fact the checker knows`);
  }
  function checkPitwall(e, what, text, flat) {
    const r = repo();
    const live = r && r.box ? r.live() : null;
    if (what === "task") {
      const id = e.attrs["data-task"];
      if (!id) { once(e.line, 'data-source="pitwall:task" needs data-task="<task id>"'); return; }
      if (!live) { if (flat !== "notrecorded") once(e.line, `no pit wall data for task ${id}, the page says ${text}: write "not recorded"`); return; }
      const v = live.state.verification.tasks[id] || "not done";
      if (squash(v) !== flat) once(e.line, v === "claimed" ? `${id} is claimed in the pit wall's data (no passing run seen after its last edit), the page says ${text}` : `${id} is ${v} in the pit wall's data, the page says ${text}`);
      return;
    }
    const unit = e.unit;
    if (!unit) { once(e.line, `data-source="pitwall:${what}" needs data-unit="<unit id>" on it or on its list`); return; }
    let want = null;
    if (live && what === "tests") {
      const runs = live.events.filter(x => x.test && x.test.observed && x.test.passed !== undefined && (x.unit === unit || String(x.unit || "").startsWith(unit + ".")));
      const last = runs[runs.length - 1];
      if (last) want = `${last.test.passed}/${last.test.passed + (last.test.failed || 0)}`;
    } else if (live) {
      const t = live.state.tokens;
      const row = unit.includes(".") ? t.byTask.find(x => x.id === unit) : t.byEpic.find(x => x.id === unit);
      if (row) want = what === "tokens" ? fmtTok(row.tokens) : what === "cost" ? (row.cost == null ? "no price" : "$" + row.cost.toFixed(2)) : fmtMs(row.ms);
    }
    if (want == null) { if (flat !== "notrecorded") once(e.line, `no pit wall data for ${what} on ${unit}, the page says ${text}: write "not recorded"`); return; }
    if (squash(want) !== flat) once(e.line, what === "tests" ? `the pit wall's last observed test run for ${unit} was ${want}, the page says ${text.replace(/\s+/g, "")}` : `the pit wall recorded ${want}${what === "tokens" ? " tokens" : ""} for ${unit}, the page says ${text}`);
  }
  function checkLocal(href, line, what) {
    if (!file) return;
    const target = path.resolve(path.dirname(file), decodeURIComponent(href.split(/[?#]/)[0]));
    if (!fs.existsSync(target)) once(line, `${what} ${href}: no such file (is {{ROOT}} right for where this page lives?)`);
  }
  function checkLink(href, line) {
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(href)) return; // external, mail, and the pit wall's own "/"
    if (href.startsWith("#")) { const id = decodeURIComponent(href.slice(1)); if (id && !ids.has(id)) once(line, `link to ${href}: no element has id="${id}" on this page`); return; }
    if (!file) return;
    const rel = decodeURIComponent(href.split(/[?#]/)[0]);
    const target = path.resolve(path.dirname(file), rel);
    if (rel && !fs.existsSync(target)) { once(line, `link to ${href}: no such file. Link only to Boxbox pages that exist, or remove the link`); return; }
    const frag = href.includes("#") ? decodeURIComponent(href.split("#")[1]) : "";
    if (rel && frag && /\.html?$/.test(rel)) {
      let other = "";
      try { other = fs.readFileSync(target, "utf8"); } catch {}
      if (!new RegExp(`\\sid=["']${reEsc(frag)}["']`).test(other)) once(line, `link to ${href}: ${rel} has no id="${frag}"`);
    }
  }
}

/* ---------- command line ---------- */
function main(argv) {
  const files = [];
  let templatesDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--templates") templatesDir = argv[++i];
    else files.push(argv[i]);
  }
  if (!files.length) { console.error("Usage: node .boxbox/pitwall/check-page.js <page.html> [more pages]"); return 2; }
  const kit = loadKit(path.resolve(templatesDir || path.join(__dirname, "..", "templates")));
  let failed = 0;
  for (const f of files) {
    let html;
    try { html = fs.readFileSync(f, "utf8"); } catch { console.log(`${f}: cannot read the file`); failed++; continue; }
    const problems = checkPage(html, { file: f, kit });
    if (!problems.length) { console.log(`${f}: OK`); continue; }
    failed++;
    console.log(`${f}: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
    for (const p of problems) console.log(`  line ${p.line}: ${p.msg}`);
  }
  if (failed) console.log(`\nFix these in the page, then run the checker again. Change content only: never the template's head, scripts or CSS.`);
  return failed ? 1 : 0;
}

module.exports = { checkPage, tokenize };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
