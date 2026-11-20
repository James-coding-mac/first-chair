# AI team: roles, rules, session rotation

## Roles
| Role | Who | Does | Never does |
|---|---|---|---|
| Manager / architect | Claude Code (main session) | Plans steps, splits tasks, integrates, commits | Commits work that hasn't been reviewed |
| Builder | Codex CLI, Claude sub-agents | Implements one scoped task at a time | Touches files outside its task |
| Bulk worker | Qwen 3.6 27B (local, free) | Data cleaning, drafting text, generating test cases, first-pass code review | Anything where facts matter without a source |
| Checker | Claude sub-agent (fresh context) | Checks that the change matches the task, tests pass, and v1 behaviour is kept | — |
| Risk / security | Claude sub-agent + Codex review | Looks for bugs, XSS, unsafe `innerHTML`, leaked secrets, over-broad permissions, bad data | — |

## Flow per task
1. The manager writes a task brief (goal, files, done-when) in `docs/sessions/`.
2. A builder implements it.
3. A checker and a risk agent review it independently.
4. The manager fixes or rejects, then commits with a message that names the step.

## Keeping context small
- One **plan step = one session**. Each tool gets its own session per step: Claude, `codex` in `~/code/first-chair`, and Qwen chats.
- Start a **new session** when a step is done, when the conversation has been compacted once, or when the topic changes.
- Before ending a session: update `docs/STATUS.md` and write `docs/sessions/YYYY-MM-DD-stepN.md` (what was done, what's next, open questions).
- A new session starts with: "Read CLAUDE.md and docs/STATUS.md, then continue."

## Using Qwen
`tools/qwen.sh "instruction" [file ...]`. LM Studio must be running with `qwen3.6-27b-mlx` loaded (`lms server start`).
