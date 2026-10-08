---
name: boxbox-grill
description: Stress-test a plan, design or decision with hard questions before it is built. Use when the developer says grill me, grill the plan, challenge this, poke holes in this, am I missing something, or wants a decision pressure-tested, and offer it at the plan stop when the plan has a costly or irreversible decision.
---

# Boxbox grill

Find the weak points while changing course is still cheap. Two modes; pick by what the developer asked.

## Mode 1: grill the plan or the design (you attack your own work)

Read the plan or the design page, the decisions and the context. Then try to break it. For each angle, either name a concrete problem or say you found none:

- **Wrong problem.** Does the plan solve what the developer asked, or something nearby?
- **Simpler way.** Is there a version with half the tasks that gets most of the value? What could be deleted?
- **Failure.** Walk each failure mode in the context. What happens at 2am when it goes wrong, and who finds out how?
- **Scale and time.** What breaks at ten times the data, or in a year when nobody remembers this?
- **Security and abuse.** Who could misuse it, and what could they reach?
- **Hidden coupling.** What else in the codebase depends on what this changes?
- **Order.** Does an early task lock in something a later decision could overturn?
- **Assumptions.** Which facts is the plan resting on that you did not verify?

Report the findings as a short list, worst first. For each: the problem, the evidence, and what you would change. Do not pad the list; three real problems beat ten weak ones. Then ask the developer which to act on. Make the changes through the skill that owns the page (**boxbox-plan** for a plan, **boxbox-design** for a design) and return to that page's stop: a grilled plan or design still needs its approval.

## Mode 2: grill me (you question the developer's thinking)

The developer has a decision or an idea and wants it tested.

1. Ask one question at a time. Each question goes after the weakest part of what they said so far.
2. With each question, give your own answer and the reason, so they can agree in a word or push back.
3. Follow the branches: an answer that opens a new question gets that question next.
4. If the code can answer a question, read the code instead of asking.
5. Do not let a vague answer pass. "It should be fine" gets "what happens when it is not?"
6. Stop when the open branches are closed or the developer says enough.

Disagree when you disagree. The point is to find what is wrong, not to make them feel sure.

## End with what changed

Summarise in a few lines: what held up, what changed, what is still open. Record changed decisions as `.boxbox/GUIDE.md` says under "Recording a decision", and re-plan if the split moved. If records changed outside a stop, commit them: `Boxbox: decisions after grill`.
