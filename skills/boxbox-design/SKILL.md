---
name: boxbox-design
description: "Sketch the shape of an epic before code: modules, data shapes, interfaces and the path between them, for the developer's approval. Use when a plan marks an epic with a design stop, when an epic adds a new module, data model, public interface or cross-service boundary, or when the developer says design this first, architect this, or show me the shape before you build."
---

# Boxbox design

Tasks say what will change. A design says what shape it will have. Getting the data shapes and interfaces right first makes the code that follows obvious; getting them wrong is the costliest thing to fix later. The developer owns this choice.

This skill writes no feature code.

Read `.boxbox/GUIDE.md`, `config.md`, and the feature's `context.md`, `plan.md` and decisions first.

## 1. Find the shape

For the epic in hand, work out:

- **Where it lives.** Which files and modules are new, which change. Follow the codebase's existing structure.
- **The data.** Each new or changed record, table, message or type, field by field, with what is required and what can be absent. Make wrong states impossible to represent where the language lets you.
- **The interfaces.** Each new function, endpoint, event or command as a signature: name, inputs, outputs, errors. No bodies.
- **The path.** How one real request travels through these pieces, including the failure paths from the plan.
- **What it locks in.** Which of these will be costly to change once other code depends on them.

Keep to what this epic needs. Do not design for imagined later features.

## 2. Compare at least one alternative

For any shape that is costly to change, sketch a second way and say why you prefer yours. If you cannot think of an alternative, you have not understood the choice yet.

## 3. Write the two files

In the unit's folder, `.boxbox/<feature>/e1-<slug>/`:

**`design.md`** (for agents): first line `approved: no`, then the files, the data shapes and the signatures as code blocks, the path as a numbered list, the alternatives in one line each, and what is locked in.

**`design.html`** (for the developer): copy `.boxbox/templates/design.html` and fill it. `{{ROOT}}` is `../../`. If the template is missing (an older setup), refresh the kit as **boxbox-setup** describes. Explain each shape at the level `config.md` says this developer needs.

## 4. Stop

- `board-data.js`: add a "Design" link to the epic and set `waiting` to "Approve the design for <unit id>".
- `state.md`: `phase: design-review`, `unit: <id> todo`, `waiting_for_developer: yes`.
- Open `design.html` and print its path.

Ask: approve, or tell me what to change. Offer **boxbox-grill** if they want it challenged; after a grill, change the design here and stop again.

When approved:

1. Record any choice they made, as `GUIDE.md` says under "Recording a decision".
2. Set `approved: yes, <date>` in `design.md`, and on `design.html` change the pill to `<span class="pill ok">Approved <date></span>` and the ask to a plain note.
3. Clear `waiting`; set `state.md` to `phase: build`, `waiting_for_developer: no`.
4. Commit the `.boxbox/` changes on the feature branch: `Boxbox: design for <unit id> approved`.
5. Continue with **boxbox-build**, unless a prototype was agreed first. The build must follow the approved shapes. If building shows a shape is wrong, stop and bring it back here; do not quietly drift from it.
