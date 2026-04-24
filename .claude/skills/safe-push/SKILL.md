---
name: safe-push
description: Use this skill whenever the user asks to push commits to a remote (e.g., "push", "git push", "envoie sur GitHub", "pousse la branche", "push to main"). It enforces a mandatory pre-push checklist — run the test suite AND run /code-review — before actually executing git push. Never push without completing both steps.
---

# Safe Push

Enforces a two-step gate before any `git push`:
1. Run the full test suite and make sure it passes.
2. Run `/code-review` on the pending changes.

## When to invoke

Trigger this skill for any request where the user intends to publish commits to a remote — in English or French. Examples: "push", "git push", "envoie", "envoie ça sur GitHub", "pousse la branche", "publish", "push to origin", "push the PR branch".

Do **not** trigger for local-only operations (commit, stash, rebase, checkout), or for inspecting remotes (`git fetch`, `git pull`).

## Procedure (mandatory order)

### Step 1 — Check there is something to push

```bash
git status
git log @{u}..HEAD --oneline 2>/dev/null || git log -5 --oneline
```

If there are no unpushed commits, tell the user and stop. Do not push an empty branch.

### Step 2 — Run the test suite

```bash
npm test
```

- If tests fail: **stop**, report the failing tests verbatim, and ask the user how to proceed. Do not push.
- If tests pass: continue.
- If the project does not have an `npm test` script (check `package.json`), look for the appropriate command (`pytest`, `go test ./...`, `cargo test`, `make test`, etc.) and use it. If there is truly no test runner, mention this explicitly to the user and ask for confirmation before pushing.

### Step 3 — Run /code-review

Invoke the `code-review` skill (via the Skill tool if listed as available, otherwise by following the review checklist from its description). Apply the review to the **commits about to be pushed**, i.e. the diff between `@{u}` (upstream) and `HEAD`.

If code-review surfaces serious issues (security, correctness, data loss), report them and **ask** the user whether to push anyway. Minor style findings can be mentioned without blocking.

### Step 4 — Push

Once steps 1–3 are clean:

```bash
git push
```

(Or `git push -u origin <branch>` if the branch has no upstream yet.)

Report the new remote SHA and, if relevant, the PR URL.

## Non-negotiables

- **Never** use `--no-verify` or `--force` / `--force-with-lease` unless the user explicitly asks for it in the same turn. Push to `main` or `master` with `--force*` is always dangerous — warn before running.
- **Never** skip steps 2 or 3 "because the change is small". The whole point of this skill is consistency.
- **Never** run the tests in the background and push immediately — wait for the test result.
- If the user says "just push" / "push quickly" / "skip tests", treat it as an explicit override: mention that tests and review are being skipped, then push. Do not refuse.

## Short form for small / internal loops

If the tests have already run in the current conversation **and the code has not changed since**, you can skip re-running them — but still run `/code-review` on the pending commits, since a review on a stale tree is worthless.
