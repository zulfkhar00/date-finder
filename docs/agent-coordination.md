# Agent coordination policy (canonical)

Two developers, each with their own agent, both shipping complete features end to end in this repo:
**Zulya → Codex (`zulfkhar-bot`)**, **Miko → Claude Code (`claude-miko`)**. The only goal of this
policy is to stop the two agents from silently building the same or overlapping thing.
No mandatory peer review. No chatter between agents beyond what a conflict needs.

Use `bdh` (BeadHub wrapper), never raw `bd`, for anything shared. If `bdh` isn't registered on this
machine yet, `bd` against the shared database is the fallback, and you must tell the user that claims
are not yet visible to the other agent.

## Before any substantial change (feature, bug fix, refactor)

Do this automatically — the user should never have to ask.

1. **Scope it** in one sentence: user-visible feature, modules/routes/tables/APIs it touches.
2. **Read team state:** `bdh :status` (claims + file reservations) and
   `bdh list --status in_progress` plus `bdh list --status open` and recently closed
   (`bdh list --all --sort updated | head -30`).
3. **Compare by meaning, not title.** "Recurring billing" overlaps "Stripe subscription payments";
   "login with Google" overlaps "auth" work touching the same routes. Check shared files, tables,
   endpoints and user flows.
4. **Overlap found → stop before editing** and tell the user: which task, which agent owns it, what
   overlaps, and a proposal to narrow the request into independent work. Don't take over the claim.
5. **No overlap →** reuse a matching open task or `bdh create --title ... --description ...
   --type feature|bug|task --priority 2` with the scope from step 1 in the description, then
   `bdh update <id> --claim`, then `bdh show <id>` to confirm you own it. Only then edit code.
6. Work on its own branch or worktree (`bdh :add-worktree` or `git worktree add`). One task, one PR.
7. Scope changed? `bdh update <id> --description ...` so the other agent sees it.
8. Done → `bdh close <id> --reason "PR #N"`.

Questions, investigation, reading code and writing plans need no claim, as long as no implementation
files change.

## Hard rules

- Never bypass, steal, or auto-take an expired/abandoned claim. Ask the humans.
- If BeadHub is unreachable, don't start substantial implementation — tell the user first.
- Claims are not a lock against *semantic* overlap: two agents creating different-titled tasks at the
  same moment can both succeed. When in doubt, treat it as a conflict and ask.
- Don't block unrelated work. Small typo/doc fixes don't need a task.
- Never commit `.beadhub`, `.aw/`, API keys or machine identities (already in `.gitignore`).

## What is enforced vs instructed (Claude Code side)

- **Enforced:** `.claude/hooks/coord-guard.sh` (PreToolUse on Edit/Write) blocks edits to source files
  unless this workspace has an `in_progress` task assigned to it. Docs, `.beads/`, `.claude/`, and
  `*.md` are exempt. Escape hatch for humans: `touch .beads/guard-off` (git-ignored).
- **Injected every prompt:** `.claude/hooks/coord-context.sh` (UserPromptSubmit) adds the live
  in-progress list so the agent sees the other agent's work before deciding anything.
- **Instructed only:** semantic overlap judgement (steps 3–4). No tool can guarantee it.
- **Codex side:** instructions only (AGENTS.md → this file) unless Codex hooks are added.
