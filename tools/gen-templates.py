# Generates skills/boxbox-setup/kit/templates/<kind>.html from one shared head and shell.
# Run from the repo root: python3 tools/gen-templates.py skills/boxbox-setup/kit/templates
import pathlib, sys
OUT = pathlib.Path(sys.argv[1])
FONTS = "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400&family=JetBrains+Mono:wght@400;500&display=swap"
THEME = '<div class="theme" role="radiogroup" aria-label="Colour theme"><button type="button" role="radio" data-theme-set="auto" aria-checked="true">Auto</button><button type="button" role="radio" data-theme-set="light" aria-checked="false">Light</button><button type="button" role="radio" data-theme-set="dark" aria-checked="false">Dark</button></div>'

RULES = """     HOW TO FILL THIS PAGE (the full rules are under "Pages" in .boxbox/GUIDE.md)
     1. Copy it with cp. Never write the page from scratch or from memory.
     2. Replace the {{...}} placeholders and the sample markup inside each <section>. Keep the head, the
        bar, the contents column, the footer shell and the script exactly as they are.
     3. Each section says what goes in it and how deep. data-required="yes" sections must stay;
        data-min-words is the least prose they need (code blocks and diagrams do not count).
        Delete a data-required="no" section that has nothing true to say. Copy a data-repeat section
        once per item. To add a section, build it only from templates/_components.html.
     4. Never write <style>, style= or a class that is not in templates/_components.html.
     5. Label where every claim comes from: replace each data-evidence="{{...}}" with observed (the pit
        wall or you saw it run), code (read in the repo), inferred (your reasoning), unknown (nobody
        knows yet) or source (a link to the source in the same block). "unknown" is allowed; guessing
        is not. Facts with data-source (tests, diff counts, commits, tokens) are what git and the pit
        wall say, never your estimate; with no pit wall data, write "not recorded". Quote repo code
        exactly with data-quote, and cite lines as path:line.
     6. Run: node .boxbox/pitwall/check-page.js <this page>. Fix every problem it lists, run it again.
        Then run the fact-check (boxbox-inspect, page mode), fix what it finds, and only then show the
        page. Delete these instruction comments once the page is filled."""

def page(kind, where, root, crumbs, head, sections, foot, article=""):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="boxbox-page" content="{kind}">
<title>{{{{TITLE}}}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="{{{{ROOT}}}}assets/boxbox.css">
<script src="{{{{ROOT}}}}assets/boxbox.js"></script>
</head>
<body>
<!-- TEMPLATE: {kind} page. Copy to {where}. {{{{ROOT}}}} is "{root}".
{RULES} -->
<header class="pagebar">
  <nav class="crumbs" aria-label="Breadcrumbs"><span class="brandlink">boxbox</span><a class="pitlink" href="/">Pit wall</a><a href="{{{{ROOT}}}}board.html">Board</a>{crumbs}</nav>
  {THEME}
</header>
<div class="doc">
  <nav class="toc" aria-label="Contents"><p class="readtime"></p><ol></ol></nav>
  <article class="article"{article}>
{head}
{sections}
{foot}
  </article>
</div>
</body>
</html>
"""

def sec(name, title, req, minw, comment, body, short=None, repeat=False, cls=None, items=0, svg=False, max_items=0):
    attrs = f' class="{cls}"' if cls else ""
    rep = " data-repeat" if repeat else ""
    sh = f' data-short="{short}"' if short else ""
    extra = (f' data-min-items="{items}"' if items else "") + (f' data-max-items="{max_items}"' if max_items else "") + (' data-needs="svg"' if svg else "")
    return f"""
    <section{attrs} data-section="{name}" data-required="{req}" data-min-words="{minw}"{extra}{rep} id="{name}">
      <!-- {comment} -->
      <h2{sh}>{title}</h2>
{body}
    </section>"""

def foot(links, source):
    items = "".join(f'<a class="pagelink" href="{h}">{t}</a>' for t, h in links)
    return f"""
    <footer class="pagefoot">
      <!-- Related pages. Keep only links to pages that exist; the checker fails on a missing one. -->
      <h2>Related pages</h2>
      <nav class="pagelinks" aria-label="Related pages">{items}</nav>
      <p>{source}</p>
    </footer>"""

CHECK = """      <ol class="checks">
        <li><details><summary>{{A why question about a choice in this work}}</summary><div>{{The answer, in two or three sentences, pointing at the code.}}</div></details></li>
        <li><details><summary>{{A "what happens if" question about a failure}}</summary><div>{{The answer.}}</div></details></li>
        <li><details><summary>{{A question about the trickiest line}}</summary><div>{{The answer.}}</div></details></li>
      </ol>"""

PATH = """      <!-- One li per step. span.at is file:line; for code not written yet, the file and "(new)". -->
      <ol class="path">
        <li><b>{{What happens at this step, in plain words}}</b><span class="at">{{path/to/file.js:42}}</span><p>{{What this step does, what it hands on, and what happens when it fails.}}</p></li>
        <li><b>{{Next step}}</b><span class="at">{{path:line}}</span><p>{{...}}</p></li>
      </ol>"""

DIAGRAM = """<figure class="diagram wide">
<svg viewBox="0 0 760 210" role="img" aria-label="{{One sentence: what the diagram shows, naming the boxes and arrows}}">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="d-head" d="M0 0L10 5L0 10z"/></marker></defs>
  <rect class="d-box" x="20" y="74" width="170" height="62"/><text class="d-label" x="36" y="100">{{Module}}</text><text class="d-sub" x="36" y="120">{{src/file.js}}</text>
  <rect class="d-box hot" x="300" y="74" width="170" height="62"/><text class="d-label" x="316" y="100">{{Module}}</text><text class="d-sub" x="316" y="120">{{src/file.js}}</text>
  <path class="d-edge hot" d="M190 105 H296" marker-end="url(#arrow)"/>
</svg>
<figcaption>{{What to notice in the diagram.}}</figcaption>
</figure>"""

TESTS = """      <div class="table"><table>
        <thead><tr><th>Test</th><th>What it proves</th></tr></thead>
        <tbody>
          <tr><td><code data-test>{{test function name, exactly as in the test file}}</code></td><td>{{the behaviour it pins down, in plain words}}</td></tr>
        </tbody>
      </table></div>"""

RISKS = """      <ul class="findings">
        <li data-st="flag"><span class="status" data-st="flag">high</span><b>{{The risk or edge case, in one line}}</b><p>{{What would happen, how likely, and what limits it today.}}</p></li>
        <li data-st="move"><span class="status" data-st="move">medium</span><b>{{...}}</b><p>{{...}}</p></li>
        <li><span class="status">low</span><b>{{...}}</b><p>{{...}}</p></li>
      </ul>"""

CHANGES = """      <ul class="changes">
        <li class="change"><code>{{path/to/file}}</code><span class="delta" data-source="git:diff" data-file="{{path/to/file}}"><ins>+{{N}}</ins><del>−{{N}}</del></span><p><b>What:</b> {{what changed}}</p><p><b>Why:</b> {{why it changed this way}}</p></li>
      </ul>
<figure class="code" data-evidence="code">
<figcaption><code>{{path/to/file}}</code><span>lines {{N}} to {{N}}</span></figcaption>
<pre data-quote="{{path/to/file}}:{{first line}}-{{last line}}"><code>{{those lines exactly as they are in the repo}}<b class="pin">1</b></code></pre>
<ol class="code-notes">
  <li>{{What this line does and why it is written this way.}}</li>
</ol>
</figure>
      <!-- Repeat per file that matters: an h3 with the file name, a paragraph of why, then its figure.
           Use figure.diff (before and after) where the change is clearer than the result. -->"""

def head(h1, lede, marks="", metrics="", move=""):
    out = f"""    <header class="doc-head">
      <h1>{h1}</h1>
      <p class="lede">{lede}</p>"""
    if marks: out += f"\n      <div class=\"marks\">{marks}</div>"
    if metrics: out += "\n" + metrics
    out += "\n    </header>"
    if move: out += "\n" + move
    return out

T = {}

# ---------------- context ----------------
T["context"] = page("context", ".boxbox/<feature>/context.html", "../",
  '<span aria-current="page">{{FEATURE TITLE}}: context</span>',
  head("{{One line: what was asked for, as a plain statement}}",
       "{{Two or three sentences: what this feature is, in the developer's words, and what done looks like.}}",
       '<span class="status" data-st="move">read before the decisions</span>'),
  "".join([
    sec("overview", "What this project is, and who it serves", "yes", 120,
        "The product and its users, what this repo is inside it, and how it runs. Facts name real files and commands.",
        """      <p>{{What the product does, for whom, and where this repo fits.}}</p>
      <dl class="facts">
        <dt>Stack</dt><dd>{{languages, frameworks, versions, with <code>paths</code>}}</dd>
        <dt>How it runs</dt><dd>{{build, test, lint and run commands}}</dd>
        <dt>Entry points</dt><dd>{{routes, commands, screens, jobs}}</dd>
      </dl>""", short="The project"),
    sec("architecture", "How it is built", "yes", 80,
        "A box-and-arrow diagram of the REAL modules (not layers in general), then a paragraph per box this feature meets. Mark what is outside the repo with d-box out.",
        "      <p>{{The modules this feature meets and how they depend on each other.}}</p>\n" + DIAGRAM, short="Architecture", svg=True),
    sec("flow", "How a request travels today", "yes", 120,
        "The path a real request or data item takes through the code this feature changes, in order, with file:line. For a brand-new feature, trace the nearest existing path it will reuse, and say so.",
        "      <p>{{What starts the path, and where it ends.}}</p>\n" + PATH, short="Request path"),
    sec("conventions", "Patterns and conventions to follow", "yes", 80,
        "How this codebase already does things the feature must match: naming, errors, tests, data access. Each with a file reference.",
        """      <ul>
        <li><strong>{{pattern}}</strong>: {{how it is done here, with <code>path:line</code>, and why the new code follows it}}</li>
      </ul>""", short="Conventions"),
    sec("constraints", "Constraints", "yes", 60,
        "Performance, security, platform and team limits that shape the design. Only real ones.",
        """      <ul>
        <li><strong>{{constraint}}</strong>: {{where it comes from and what it rules out}}</li>
      </ul>"""),
    sec("scope", "What this touches, and what it must not", "yes", 60,
        "Two lists: the files and modules that will change, and the ones that must stay untouched (with why).",
        """      <h3>Will change</h3>
      <ul class="tree">
        <li><code>{{src/}}</code><ul><li data-st="changed"><code>{{file}}</code><span>{{why}}</span></li><li data-st="new"><code>{{file}}</code><span>{{why}}</span></li></ul></li>
      </ul>
      <h3>Must not change</h3>
      <ul><li><code>{{path}}</code>: {{why it stays as it is}}</li></ul>""", short="Scope"),
    sec("concepts", "Ideas this feature needs", "yes", 40,
        "Each concept the feature depends on. 'known' if config.md says the developer knows it; 'new' links a knowledge page. For each NEW concept, add an h3 below the table that teaches it here in a paragraph or two, with a term definition, so the reader can decide without leaving the page.",
        """      <div class="table"><table>
        <thead><tr><th>Concept</th><th>In one line</th><th>Where it shows up</th><th>For you</th></tr></thead>
        <tbody>
          <tr><td>{{concept}}</td><td>{{plain definition}}</td><td>{{which part of the feature}}</td><td><span class="level" data-level="new">new</span> <a href="{{ROOT}}knowledge/{{slug}}.html">read</a></td></tr>
          <tr><td>{{concept}}</td><td>{{plain definition}}</td><td>{{which part}}</td><td><span class="level" data-level="known">known</span></td></tr>
        </tbody>
      </table></div>""", short="Concepts"),
    sec("failure", "How this can fail", "yes", 60,
        "Failure thinking before design: bad input, timeouts, retries, load, partial failure, abuse. Only real ones for this feature.",
        RISKS, short="Failure"),
    sec("answers", "What you told me", "no", 0,
        "Context the code cannot hold: history, team rules, deadlines. From the developer's answers.",
        """      <div class="table"><table>
        <thead><tr><th>Asked</th><th>Answer</th></tr></thead>
        <tbody><tr><td>{{question}}</td><td>{{the developer's answer, or "not answered yet"}}</td></tr></tbody>
      </table></div>""", short="From you"),
    sec("open", "Open questions", "yes", 20,
        "Questions the code cannot answer. Each becomes a decision or a default on the decisions page.",
        """      <ul><li>{{question}}</li></ul>""", items=1),
    sec("glossary", "Words used on this page", "yes", 30,
        "Every term a newcomer to this codebase would stumble on, defined plainly.",
        """      <dl class="terms"><dt>{{term}}</dt><dd>{{plain definition, and where it lives in this repo}}</dd></dl>""", short="Glossary"),
  ]),
  foot([("Decisions", "decisions.html"), ("Plan", "plan.html"), ("{{Knowledge page}}", "{{ROOT}}knowledge/{{slug}}.html")], "Source for the agent: context.md"),
  article=' data-commit="{{the commit this page describes, usually HEAD of the main branch}}"')

# ---------------- knowledge ----------------
T["knowledge"] = page("knowledge", ".boxbox/knowledge/<slug>.html", "../",
  '<span aria-current="page">{{TOPIC}}</span>',
  head("{{TOPIC}}", "{{Who this is for, how far it goes (only what this project needs), and what they can read or decide afterwards.}}"),
  "".join([
    sec("unchecked", "Not checked", "no", 0,
        "If something here could not be run or checked against the docs, say so. Delete the section otherwise.",
        """      <aside class="callout" data-kind="warning"><p><b>Not checked.</b> {{what could not be run or verified, and why}}</p></aside>"""),
    sec("idea", "The idea in plain words", "yes", 120,
        "The concept with no jargon, and ONE analogy from everyday life. Define every term on first use with a glossary term.",
        """      <aside class="side"><p><b>Where you'll meet it</b></p><ul><li><code>{{path}}</code></li></ul></aside>
      <p>{{The idea in two or three plain sentences.}}</p>
      <p>{{One analogy, and where it stops being true.}}</p>""", short="The idea"),
    sec("why", "Why it exists", "yes", 100,
        "The problem it solves: what goes wrong without it, concretely.",
        """      <p>{{The problem, with a concrete failure.}}</p>"""),
    sec("how", "How it works, step by step", "yes", 150,
        "The mechanism in order, with a diagram. Code that runs, then exactly what it prints (run it; never invent output).",
        DIAGRAM + """
      <p>{{Step by step, referring to the diagram.}}</p>
<figure class="code">
<figcaption><span>{{what this shows}}</span></figcaption>
<pre><code>{{small runnable code}}</code></pre>
<pre class="output"><code>{{exactly what it prints}}</code></pre>
</figure>""", short="How it works", svg=True),
    sec("here", "How this repo uses it", "yes", 100,
        "Where it appears in THIS codebase, with file and line references, and what would break if it were removed.",
        """      <ul><li><code>{{path:line}}</code>: {{what it does there}}</li></ul>""", short="In this repo"),
    sec("example", "A worked example", "yes", 120,
        "Trace one real input through the real code, step by step, showing the values at each step.",
        PATH),
    sec("mistakes", "Common mistakes", "yes", 80,
        "The traps people fall into with this idea, how to notice each one, and the fix.",
        """      <!-- Colour each trap by how much damage it does: flag (serious), move (costly), none (minor). -->
      <ul class="findings">
        <li data-st="move"><span class="status" data-st="move">trap</span><b>{{the mistake}}</b><p>{{how to notice it, and the fix}}</p></li>
      </ul>""", items=2),
    sec("not", "When not to use it", "yes", 60,
        "Where this idea is the wrong tool, and what to use instead.",
        """      <p>{{Cases where it does not fit, and the alternative.}}</p>""", short="When not to"),
    sec("check", "Check yourself", "yes", 40,
        "Three to five questions with hidden answers. At least one 'what happens if'.",
        CHECK, items=3),
    sec("reading", "Further reading", "yes", 10,
        "Two to four trusted sources: official docs, specs, well-known references. Say what to read there.",
        """      <ul><li><a href="{{https://official docs URL}}">{{Primary source}}</a>: {{what to read there}}</li></ul>""", short="Reading", items=2),
  ]),
  foot([("Board", "{{ROOT}}board.html"), ("{{Context page that sent you here}}", "{{ROOT}}{{feature}}/context.html")], "Ask the agent about anything here that is unclear."),
  article=' data-commit="{{the commit the repo examples come from}}"')

# ---------------- decisions ----------------
T["decisions"] = page("decisions", ".boxbox/<feature>/decisions.html", "../",
  '<a href="plan.html">{{FEATURE TITLE}}</a><span aria-current="page">Decisions</span>',
  head("Decisions for {{FEATURE TITLE}}",
       "{{While open: how many decisions need you, and that you will ask them one at a time. Once answered: say so, and how many overrode the recommendation.}}",
       '<span class="status" data-st="move">{{N}} to decide</span><span class="status" data-st="done">{{N}} answered</span><span class="status">{{N}} parked</span>'),
  "".join([
    sec("decision", "<data>D1</data>{{The question, as a question}}", "yes", 120,
        "ONE per decision, hardest to change first (copy this section for D2, D3...; ids d2, d3). Say why it matters NOW, compare the options in the table, recommend one and why (tied to a fact on the context page), what it costs to change later, and who decided. When answered: status to answered, chosen row tr.chosen (plus override if against the recommendation), and the Decided by line.",
        """      <span class="status" data-st="move">to decide</span>
      <p>{{Why this matters now: what it changes in the build and what depends on it.}}</p>
      <div class="table"><table>
        <thead><tr><th>Option</th><th>What it means here</th><th>Gains</th><th>Costs</th></tr></thead>
        <tbody>
          <tr><td>{{Option A}}</td><td>{{in this codebase}}</td><td>{{gain}}</td><td>{{cost}}</td></tr>
          <tr><td>{{Option B}}</td><td>{{...}}</td><td>{{gain}}</td><td>{{cost}}</td></tr>
        </tbody>
      </table></div>
      <p><strong>Recommendation:</strong> {{A}}. {{The reason, tied to a fact on the context page.}}</p>
      <!-- Only when the developer chose against the recommendation (row gets class "chosen override"): -->
      <p><strong>Override:</strong> {{what they chose instead, and their reason in their words}}</p>
      <!-- Parked: status <span class="status">parked</span>, no row chosen, and say what unblocks it here:
           <p><strong>Parked until:</strong> {{the fact or event that settles it, and what waits on it}}</p> -->
      <dl><dt>Cost to change later</dt><dd>{{easy / costly / cannot be undone, and why}}</dd><dt>Decided by</dt><dd>{{name and date, or "waiting for you"}}</dd></dl>""",
        repeat=True, cls="decision", short="{{D1: short name}}").replace('id="decision"', 'id="d1"'),
    sec("defaults", "Defaults I chose", "no", 0,
        "Small choices that are easy to change. If the developer changes one, keep its row and say 'Replaced by D4'.",
        """      <div class="table"><table>
        <thead><tr><th>Choice</th><th>Why</th><th>Change later</th></tr></thead>
        <tbody><tr><td>{{A1: choice}}</td><td>{{reason}}</td><td>{{easy, how}}</td></tr></tbody>
      </table></div>""", short="Defaults"),
  ]),
  foot([("Context", "context.html"), ("Plan", "plan.html")], "Recorded in decisions.md. Decision level is set in config.md."))

# ---------------- plan ----------------
T["plan"] = page("plan", ".boxbox/<feature>/plan.html", "../",
  '<span aria-current="page">{{FEATURE TITLE}}: plan</span>',
  head("Plan: {{FEATURE TITLE}}",
       "{{The outcome in one or two sentences: what a person can do when this ships.}}",
       '<span class="status" data-st="move">waiting for your go</span><span class="status">{{N}} epics, {{N}} tasks</span>',
       "",
       """    <!-- After approval, change this to data-kind="note" with "Approved {{date}}. Building E1." -->
    <aside class="callout" data-kind="move"><p><b>Your move.</b> Say "go" and I start E1. Or tell me what to change: order, scope, unit of control.</p></aside>"""),
  "".join([
    sec("goal", "Goal and non-goals", "yes", 60,
        "What this plan delivers, and what it deliberately leaves out (so nobody expects it).",
        """      <p>{{The goal.}}</p>
      <h3>Not in this plan</h3>
      <ul><li>{{non-goal, and why it is out}}</li></ul>""", short="Goal"),
    sec("decisions", "Decisions behind the plan", "no", 0,
        "One row per decision; tr.override where the developer chose against the recommendation.",
        """      <div class="table"><table>
        <thead><tr><th>Decision</th><th>Choice</th><th>What it means for the plan</th></tr></thead>
        <tbody><tr><td>{{D1: question}}</td><td>{{choice}}</td><td>{{effect}}</td></tr></tbody>
      </table></div>""", short="Decisions"),
    sec("milestones", "Milestones, epics and tasks", "yes", 150,
        "One article.epic per epic, in shipping order. Each epic: outcome, branch, dependencies, design stop, Done when. Each task: one thin slice, its FIRST test, how it can fail, and its file globs. Mark a step only the developer can do with a 'you' status. Keep task data-st current as work moves: todo, live (in progress), move (waiting on the developer), done, verified (the pit wall saw a passing run). A milestone is an h3 before its epics.",
        """      <h3>{{M1: milestone name}}</h3>
      <p>{{What this milestone makes possible.}}</p>
      <article class="epic" id="e1">
        <span class="status">to do</span>
        <h3><data>E1</data>{{Epic title}}</h3>
        <p>{{What a person can use, see or verify when this epic is done.}}</p>
        <dl class="facts"><dt>Branch</dt><dd><code>{{epic branch}}</code></dd><dt>Depends on</dt><dd>{{nothing / E0}}</dd><dt>Design stop</dt><dd>{{no / yes, because...}}</dd></dl>
        <h4>Done when</h4>
        <ul class="accept"><li>{{an acceptance criterion that can be checked}}</li></ul>
        <ol class="tasks">
          <li data-st="todo"><b>E1.1</b>{{What changes, in one sentence}}
            <dl><dt>First test</dt><dd><code>{{test name}}</code>: {{what it asserts}}</dd><dt>Fails when</dt><dd>{{failure mode this task must handle}}</dd><dt>Files</dt><dd><code>{{src/file.js}}</code>, <code>{{test/**}}</code></dd></dl></li>
        </ol>
      </article>""", short="Epics and tasks"),
    sec("order", "The order, and why", "yes", 40,
        "Which epic depends on which, as a flow diagram or a short list, and why this order lowers risk.",
        """      <ol><li>{{E1 first, because...}}</li></ol>""", short="Order"),
    sec("risks", "Risks", "yes", 50,
        "What could derail the plan: unknowns, migrations, external services. Worst first.",
        RISKS),
    sec("stops", "Where I stop for you", "yes", 30,
        "Every point where work waits for the developer: plan approval, design stops, unit reviews, steps only they can do. Stops already passed get a done status.",
        """      <ul><li><span class="status" data-st="move">you</span> {{the stop, and what you decide there}}</li></ul>""", short="Stops"),
    sec("done", "How we will know the milestone is done", "yes", 40,
        "The checks that prove the whole milestone works: tests, a manual walkthrough, a number to hit.",
        """      <ul class="checklist">
        <li><label><input type="checkbox"><div>{{a check anyone can run}}<span>{{what they should see}}</span></div></label></li>
      </ul>""", short="Done means"),
    sec("later", "Later", "no", 0,
        "Noticed, worth doing, outside this plan.",
        """      <ul><li>{{idea}}</li></ul>"""),
  ]),
  foot([("Context", "context.html"), ("Decisions", "decisions.html")], "Source for the agent: plan.md"))

# ---------------- design ----------------
T["design"] = page("design", ".boxbox/<feature>/<unit>/design.html", "../../",
  '<a href="../plan.html">{{FEATURE TITLE}}</a><span aria-current="page">{{UNIT ID}} design</span>',
  head("Design for {{UNIT ID}}: {{epic title}}",
       "{{Two sentences: the shape in plain words, and the one choice that matters most.}}",
       '<span class="status" data-st="move">waiting for your approval</span><span class="status">no code written yet</span>'),
  "".join([
    sec("problem", "The problem", "yes", 80,
        "What this epic must do, what makes it hard, and what the current code offers.",
        """      <p>{{The problem and its constraints.}}</p>"""),
    sec("ideas", "New ideas in this design", "no", 60,
        "Only for ideas config.md marks new: teach each one before the design uses it, with a term definition and a small example.",
        """      <p>{{The idea, plainly, with a term definition and a small example.}}</p>"""),
    sec("shape", "The shape of the solution", "yes", 80,
        "A diagram of the modules and data involved, new parts marked hot, then the responsibility of each.",
        DIAGRAM + """
      <ul class="changes">
        <li class="change"><code>{{path}}</code><span class="delta"><ins>new</ins></span><p><b>Its one job:</b> {{responsibility}}</p></li>
        <li class="change"><code>{{path}}</code><span class="delta">changed</span><p><b>What changes:</b> {{the change}}</p></li>
      </ul>""", short="Shape", svg=True),
    sec("interfaces", "Interfaces", "yes", 60,
        "Signatures only: function names, inputs, outputs, errors; routes with request and response; schemas field by field. No bodies.",
        """<figure class="code">
<figcaption><code>{{path}}</code><span>signatures</span></figcaption>
<pre><code>{{signatures, routes or schema}}</code></pre>
</figure>
      <dl class="terms"><dt>{{name}}</dt><dd>{{what it means, whether it can be absent, why it is this type}}</dd></dl>"""),
    sec("path", "How one request travels", "no", 60,
        "The path through the new design, with what happens when each step fails.",
        PATH, short="Request path"),
    sec("alternatives", "Alternatives considered", "yes", 60,
        "The options, with trade-offs. The proposed one marked chosen.",
        """      <div class="table"><table>
        <thead><tr><th>Option</th><th>Gains</th><th>Costs</th></tr></thead>
        <tbody>
          <tr class="chosen"><td>{{This design}}</td><td>{{gain}}</td><td>{{cost}}</td></tr>
          <tr><td>{{The alternative}}</td><td>{{gain}}</td><td>{{cost}}</td></tr>
        </tbody>
      </table></div>""", short="Alternatives"),
    sec("risks", "Risks, and what this locks in", "yes", 40,
        "What could go wrong with this shape, and which parts get costly to change once other code depends on them.",
        RISKS, short="Risks"),
    sec("approve", "What to approve", "yes", 20,
        "Exactly what the developer is agreeing to, so approval means something.",
        """      <aside class="callout" data-kind="move"><p><b>Your move.</b> Approve this shape, or tell me what to change. Say "grill the design" if you want it challenged first.</p></aside>
      <ul><li>{{the interface or data shape being agreed}}</li></ul>""", short="Approve"),
  ]),
  foot([("Plan", "../plan.html"), ("Decisions", "../decisions.html")], "Source for the agent: design.md"))

# ---------------- report ----------------
REPORT_SECTIONS = [
    sec("exists", "What now exists, and how to see it working", "yes", 120,
        "Lead with the behaviour a teammate could see, then the exact steps to see it (real commands, real output).",
        """      <p>{{What a person can now do that they could not before.}}</p>
<figure class="code wide" data-evidence="observed">
<figcaption><span>Run in the repo root</span></figcaption>
<pre><code>{{the command to run by hand}}</code></pre>
<pre class="output"><code>{{the real output}}</code></pre>
</figure>""", short="What exists"),
    sec("path", "The request path", "yes", 80,
        "The order a request meets the NEW code, not the order it was written.",
        PATH, short="Request path"),
    sec("files", "File by file", "yes", 120,
        "Per file: what changed and why. Annotated code for the parts that matter. Teach what config.md marks new.",
        CHANGES),
    sec("tests", "Tests and what they prove", "yes", 60,
        "Every test this unit added and what it proves (names exactly as in the test files). Then each task's state from the pit wall: verified when it saw a passing run after the task's last edit, claimed when it did not.",
        TESTS + """
      <p>{{One sentence on what the tests do not prove.}}</p>
      <ol class="tasks">
        <li><b>{{E1.1}}</b>{{task title}} <span class="status" data-st="verified" data-source="pitwall:task" data-task="{{E1.1}}">{{verified / claimed, as the pit wall says}}</span><p>Brief: <q data-brief="{{feature}}/{{unit}}/tasks/{{E1.1}}.md">{{the Goal line of the task's brief, copied exactly}}</q> <a href="tasks/{{E1.1}}.md">read the brief</a></p></li>
      </ol>""", short="Tests"),
    sec("decisions", "Decisions made while building", "yes", 40,
        "Choices not on the decisions page: what was chosen, the alternative, and the trade-off. Say 'None' if none, and why.",
        """      <ul><li><strong>{{choice}}</strong> over {{alternative}}: {{trade-off}}</li></ul>""", short="Decisions"),
    sec("tradeoffs", "Trade-offs and rejected alternatives", "yes", 60,
        "What this unit gave up to get what it has, and the options that were rejected with why.",
        """      <div class="table"><table>
        <thead><tr><th>Option</th><th>Gains</th><th>Costs</th></tr></thead>
        <tbody><tr class="chosen"><td>{{what was built}}</td><td>{{gain}}</td><td>{{cost}}</td></tr><tr><td>{{rejected}}</td><td>{{gain}}</td><td>{{why rejected}}</td></tr></tbody>
      </table></div>""", short="Trade-offs"),
    sec("risks", "Risks and edge cases not covered", "yes", 50,
        "What this unit does NOT handle, how likely it is, and what limits the damage. 'Nothing' only if true.",
        RISKS, short="Risks"),
    sec("manual", "Test it by hand", "yes", 30,
        "Steps the reviewer can tick off, each with what they should see.",
        """      <ul class="checklist">
        <li><label><input type="checkbox"><div>{{step}}<span>{{what you should see}}</span></div></label></li>
      </ul>""", short="By hand"),
    sec("rollback", "How to roll back", "yes", 30,
        "The exact commands to undo this unit, and anything that does not roll back with them (migrations, sent emails, data).",
        """      <p>{{What rolling back involves.}}</p>
<figure class="code"><pre><code>{{git revert ...}}</code></pre></figure>""", short="Roll back"),
    sec("cost", "Cost", "yes", 10,
        "Tokens, approximate cost and time exactly as the pit wall recorded them for this unit (node .boxbox/pitwall/server.js --summary <unit>). The checker compares them. Time is wall-clock from the unit's first stage to the next unit, waits included: say so.",
        """      <dl class="metrics">
        <div><dt>tokens</dt><dd class="metric" data-source="pitwall:tokens">{{as recorded, e.g. 950k}}</dd></div>
        <div><dt>approximate cost</dt><dd class="metric" data-source="pitwall:cost">{{as recorded, e.g. $1.62}}</dd></div>
        <div><dt>wall-clock time</dt><dd class="metric" data-source="pitwall:time">{{as recorded, e.g. 52 min}}</dd></div>
      </dl>
      <p>{{One sentence: where the tokens went.}}</p>"""),
    sec("outside", "Files edited outside this unit's scope", "no", 20,
        "Only if the pit wall saw edits outside the epic's files: which, and why.",
        """      <ul class="tree"><li data-st="outside"><code>{{path}}</code><span>{{why}}</span></li></ul>""", short="Outside scope"),
    sec("check", "Check yourself", "yes", 40,
        "Questions for the reviewer, answers hidden. If one is unclear, they should ask before approving.",
        CHECK, items=2),
    sec("verify", "Verify these yourself", "yes", 20,
        "Last, always: the three claims in this report that matter most if they are wrong, each with how to check it in a minute (a file:line to read, a test to run, a command). Exactly three.",
        """      <aside class="callout" data-kind="verify" data-evidence="{{observed | code | inferred | unknown}}">
        <ol>
          <li><b>{{The claim, in one sentence}}</b><span>{{How to check it: open path:line, run a test, or a command}}</span></li>
          <li><b>{{...}}</b><span>{{...}}</span></li>
          <li><b>{{...}}</b><span>{{...}}</span></li>
        </ol>
      </aside>""", short="Verify yourself", items=3, max_items=3),
]
T["report"] = page("report", ".boxbox/<feature>/<unit>/report.html", "../../",
  '<a href="../plan.html">{{FEATURE TITLE}}</a><span aria-current="page">{{UNIT ID}} report</span>',
  head("{{UNIT ID}} is done: {{what now exists, as a plain statement}}",
       "{{Two or three sentences a teammate could read cold: what was built and how to tell it works.}}",
       "",
       """      <!-- These come from data: the pit wall's last observed test run, git's commit count for data-range,
           and the pit wall's tokens. Write what the data says; the checker compares. -->
      <dl class="metrics">
        <div><dt>tests passed in the last run the pit wall saw</dt><dd class="metric" data-source="pitwall:tests">{{N}}<small>/{{N}}</small></dd></div>
        <div><dt>commits</dt><dd class="metric" data-source="git:commits">{{N}}</dd></div>
        <div><dt>tokens</dt><dd class="metric" data-source="pitwall:tokens">{{as recorded}}</dd></div>
      </dl>""",
       """    <!-- With no pull request, give the branch and the diff command: git diff <base>...<branch> -- . ':!.boxbox'
         After approval, change it to data-kind="note", keep the link, and say:
         <p><b>Approved {{date}}.</b> Merged as {{pull request}}. Changes after review: {{none / the section below}}.</p> -->
    <aside class="callout" data-kind="move"><p><b>Your move.</b> The code is in <a href="{{pull request or commit URL}}">{{pull request / commit}}</a>. Approve it in chat, or say what to change.</p></aside>"""),
  "".join(REPORT_SECTIONS),
  foot([("Plan", "../plan.html"), ("Context", "../context.html"), ("Decisions", "../decisions.html"), ("{{Knowledge page}}", "{{ROOT}}knowledge/{{slug}}.html")], "Source for the agent: report.md"),
  article=' data-commit="{{last commit of the unit}}" data-range="{{commit before the unit}}..{{last commit of the unit}}" data-unit="{{UNIT ID}}"')

# ---------------- explain ----------------
T["explain"] = page("explain", ".boxbox/explained/<name>.html", "../",
  '<span aria-current="page">How {{FEATURE TITLE}} works</span>',
  head("How {{FEATURE TITLE}} works",
       "{{What the feature does for a user, in two sentences, and what you will understand after this page.}}",
       '<span class="status">as of commit {{short hash}}</span>'),
  "".join([
    sec("overview", "What it is and who uses it", "yes", 100,
        "What this feature does in the product, who uses it, what it depends on. For finished work, say the page was written after the build from the code and its history.",
        """      <p>{{The feature in the product.}}</p>
      <dl class="facts"><dt>Where it lives</dt><dd>{{files, with <code>paths</code>}}</dd><dt>Entry points</dt><dd>{{routes, commands, screens}}</dd><dt>Data it owns</dt><dd>{{tables, stores}}</dd></dl>""", short="Overview"),
    sec("map", "Map of the pieces", "yes", 80,
        "A diagram of the pieces and an annotated file tree, so the reader knows where everything is before the details.",
        DIAGRAM + """
      <ul class="tree"><li><code>{{src/}}</code><ul><li><code>{{file}}</code><span>{{its job}}</span></li></ul></li></ul>""", short="Map", svg=True),
    sec("path", "How one request travels", "yes", 100,
        "The path a real request takes, in order, with file:line.",
        PATH, short="Request path"),
    sec("files", "Piece by piece", "yes", 120,
        "Per file or piece: what it does and why it is written this way, with annotated real code. For a milestone or branch, one subsection per piece in build order with its commits and diff link.",
        CHANGES, short="Pieces"),
    sec("tests", "Tests and what they prove", "yes", 40,
        "The tests that cover this feature, run NOW, with what each proves.",
        TESTS, short="Tests"),
    sec("history", "How it was built", "no", 30,
        "For finished work: the commits, approvals and decisions, in order.",
        """      <ol class="timeline"><li><time>{{date}}</time><b>{{event}}</b><p>{{what it changed}}</p></li></ol>""", short="History"),
    sec("decisions", "Why it is built this way", "no", 40,
        "Each choice with its reason and how sure we are: recorded (in a commit, PR or decisions.md), inferred, or unknown.",
        """      <div class="table"><table>
        <thead><tr><th>Choice</th><th>Reason</th><th>How sure</th></tr></thead>
        <tbody><tr><td>{{choice}}</td><td>{{reason, with its source}}</td><td>{{recorded / inferred / unknown}}</td></tr></tbody>
      </table></div>""", short="Why"),
    sec("tradeoffs", "Trade-offs", "yes", 50,
        "What this design gives up, and what it would take to change.",
        """      <ul><li><strong>{{trade-off}}</strong>: {{what it costs and when it would matter}}</li></ul>"""),
    sec("risks", "Edge cases and failure", "yes", 50,
        "How it fails today, handled or not.",
        RISKS, short="Failure"),
    sec("unclear", "What is unclear or looks risky", "yes", 60,
        "Honest notes on the existing code, each tied to a path:line: missing tests, surprising coupling, dead code, facts kept in two places. Runtime failure goes in the section above, not here. Fix nothing.",
        """      <ul class="findings"><li data-st="move"><span class="status" data-st="move">unclear</span><b><code>{{path:line}}</code> {{what}}</b><p>{{why it matters, and what would tell you more}}</p></li></ul>""", short="Unclear"),
    sec("check", "Check yourself", "yes", 40,
        "Questions to check understanding, answers hidden.",
        CHECK),
  ]),
  foot([("Board", "{{ROOT}}board.html"), ("{{Knowledge page}}", "{{ROOT}}knowledge/{{slug}}.html")], "Explains the code as of the commit named at the top. Ask the agent to refresh it after large changes."),
  article=' data-commit="{{the commit this page explains}}"')

# ---------------- review ----------------
T["review"] = page("review", ".boxbox/reviews/<name>.html", "../",
  '<span aria-current="page">Reviewing {{NAME}}</span>',
  head("Reviewing {{NAME}}",
       "{{What this change does, in three sentences a reviewer could read cold.}}",
       '<span class="status">{{skim / standard / deep}}</span><span class="status">focus: {{everything / correctness / security / design / tests}}</span><span class="status" data-st="move">approval is yours</span>'),
  "".join([
    sec("claims", "What the change claims to do", "yes", 80,
        "The behaviour the author says now exists, who it is for, and what it leaves open. Quote the PR or commits.",
        """      <aside class="side"><p><b>Written for {{reviewer}}.</b> Knows {{what they said they know}}; new to {{what is new to them}}.</p></aside>
      <p>{{The claim, in plain words.}}</p>""", short="Claims"),
    sec("path", "The request path", "yes", 80,
        "How a request moves through the CHANGED code, in order.",
        PATH, short="Request path"),
    sec("files", "File by file", "yes", 120,
        "Per-file notes, riskiest first. At skim: one line each. At deep: the code, annotated (figure.diff for the main hunk), and a definition for each new term.",
        CHANGES, short="Files"),
    sec("questions", "Questions to ask the author", "yes", 40,
        "Specific questions this change raises, each tied to a file and line.",
        """      <ol><li>{{question}} (<code>{{path:line}}</code>)</li></ol>""", short="Questions"),
    sec("risks", "Risks", "yes", 50,
        "What could go wrong after merging, worst first.",
        RISKS),
    sec("evidence", "Evidence run now", "no", 30,
        "Checks run on this branch by the agent, with real output.",
        """<figure class="code">
<figcaption><span>Run on this branch</span></figcaption>
<pre><code>{{the test command}}</code></pre>
<pre class="output"><code>{{the output, trimmed}}</code></pre>
</figure>""", short="Evidence"),
    sec("findings", "Findings from a separate reviewer", "no", 30,
        "A reviewer agent that did not write the code read the whole diff. Worst first. Nothing was fixed.",
        RISKS, short="Findings"),
    sec("glossary", "Words used on this page", "no", 20,
        "Terms new to the reviewer, defined plainly.",
        """      <dl class="terms"><dt>{{term}}</dt><dd>{{plain definition}}</dd></dl>""", short="Glossary"),
    sec("checklist", "Review checklist", "yes", 30,
        "Specific to this change and set to the depth the reviewer chose. Tick only what you have seen yourself.",
        """      <ul class="checklist">
        <li><label><input type="checkbox"><div>{{a thing to confirm}}<span>{{where to confirm it}}</span></div></label></li>
      </ul>""", short="Checklist"),
  ]),
  foot([("Board", "{{ROOT}}board.html")], "These notes change nothing in the code. Approving, merging and commenting are yours."),
  article=' data-commit="{{the change\'s last commit}}" data-range="{{its base commit}}..{{the change\'s last commit}}"')

# Evidence placeholders: on every paragraph, and every outermost list, table or margin note, inside the
# required sections of pages whose claims must be labelled. The writer replaces each with a real label.
import re
EVIDENCE_PAGES = {"report": "observed | code | inferred | unknown", "context": "observed | code | inferred | unknown",
                  "review": "observed | code | inferred | unknown", "explain": "observed | code | inferred | unknown",
                  "knowledge": "source | code | observed"}
KNOWLEDGE_FREE = {"idea", "check", "reading", "unchecked"}
CONTAINER = re.compile(r'^<(ul|ol|dl|div class="table"|aside class="side")')
def label_claims(kind, html):
    if kind not in EVIDENCE_PAGES:
        return html
    attr = f' data-evidence="{{{{{EVIDENCE_PAGES[kind]}}}}}"'
    out, depth, required = [], 0, False
    for tok in re.split(r'(<[^>]+>)', html):
        if tok.startswith("<section "):
            name = re.search(r'data-section="([^"]+)"', tok).group(1)
            required = 'data-required="yes"' in tok and not (kind == "knowledge" and name in KNOWLEDGE_FREE)
            depth = 0
        elif tok == "</section>":
            required = False
        elif required and tok.startswith("<") and not tok.startswith("</"):
            is_container = bool(CONTAINER.match(tok)) and "checklist" not in tok and 'class="checks"' not in tok
            if depth == 0 and "data-evidence" not in tok and "data-source" not in tok and (is_container or tok.startswith("<p>") or tok.startswith("<p ")):
                tok = tok[:-1] + attr + ">"
            if re.match(r'^<(ul|ol|dl|div class="table"|aside|figure|nav)\b', tok):
                depth += 1
        elif required and re.match(r'^</(ul|ol|dl|div|aside|figure|nav)>', tok) and depth:
            depth -= 1
        out.append(tok)
    return "".join(out)

for kind, html in T.items():
    html = label_claims(kind, html)
    (OUT / f"{kind}.html").write_text(html)
    print("wrote", kind)
