#!/usr/bin/env python3
"""Total tokens used on First Chair by Claude Code, Codex and Qwen. Prints JSON (used by the Übersicht ticker).

Claude: ~/.claude/projects/**.jsonl records whose cwd is inside the project, plus sessions listed in
        .ai-usage/claude-sessions.txt (sessions started elsewhere that worked on this project).
Codex:  ~/.codex/sessions/**/rollout-*.jsonl whose session cwd is inside the project (last cumulative count).
Qwen:   .ai-usage/qwen.jsonl, appended by tools/qwen.sh.
"""
import glob, json, os, time

HOME = os.path.expanduser("~")
PROJECT = os.path.join(HOME, "code", "first-chair")
USAGE_DIR = os.path.join(PROJECT, ".ai-usage")


def read_jsonl(path):
    try:
        with open(path, errors="ignore") as f:
            for line in f:
                try:
                    yield json.loads(line)
                except ValueError:
                    pass
    except OSError:
        return


def in_project(cwd):
    return bool(cwd) and (cwd == PROJECT or cwd.startswith(PROJECT + os.sep))


def claude():
    extra = set()
    try:
        extra = {l.strip() for l in open(os.path.join(USAGE_DIR, "claude-sessions.txt")) if l.strip()}
    except OSError:
        pass
    seen, total, out = set(), 0, 0
    for path in glob.glob(os.path.join(HOME, ".claude", "projects", "**", "*.jsonl"), recursive=True):
        for r in read_jsonl(path):
            msg = r.get("message") or {}
            u = msg.get("usage")
            if not u or not (in_project(r.get("cwd")) or r.get("sessionId") in extra):
                continue
            key = msg.get("id") or r.get("requestId") or r.get("uuid")
            if key in seen:  # streamed messages are logged once per content block
                continue
            seen.add(key)
            o = u.get("output_tokens", 0)
            total += u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0) + u.get("cache_read_input_tokens", 0) + o
            out += o
    return {"total": total, "output": out}


def codex():
    total = out = 0
    for path in glob.glob(os.path.join(HOME, ".codex", "sessions", "**", "rollout-*.jsonl"), recursive=True):
        ok, last = False, None
        for r in read_jsonl(path):
            p = r.get("payload") or {}
            if r.get("type") == "session_meta":
                ok = in_project(p.get("cwd"))
                if not ok:
                    break
            elif p.get("type") == "token_count" and p.get("info"):
                last = p["info"].get("total_token_usage")
        if ok and last:
            total += last.get("total_tokens", 0)
            out += last.get("output_tokens", 0)
    return {"total": total, "output": out}


def qwen():
    total = out = 0
    for r in read_jsonl(os.path.join(USAGE_DIR, "qwen.jsonl")):
        total += r.get("total_tokens", 0)
        out += r.get("completion_tokens", 0)
    return {"total": total, "output": out}


if __name__ == "__main__":
    print(json.dumps({"claude": claude(), "codex": codex(), "qwen": qwen(), "updated": int(time.time())}))
