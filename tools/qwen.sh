#!/bin/bash
# Ask the local Qwen model (LM Studio). Usage: tools/qwen.sh "instruction" [file ...]
# Files are appended to the prompt. Requires `lms server start` with the model loaded.
# Token usage is logged to .ai-usage/qwen.jsonl for the desktop ticker.
MODEL="${QWEN_MODEL:-qwen3.6-27b-mlx}"
LOG="$(cd "$(dirname "$0")/.." && pwd)/.ai-usage/qwen.jsonl"
mkdir -p "$(dirname "$LOG")"
python3 - "$MODEL" "$LOG" "$@" <<'EOF'
import json, sys, time, urllib.request
model, log, prompt, files = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
for f in files:
    prompt += f"\n\n--- {f} ---\n" + open(f).read()
body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2}).encode()
req = urllib.request.Request("http://localhost:1234/v1/chat/completions", body, {"Content-Type": "application/json"})
resp = json.load(urllib.request.urlopen(req, timeout=3600))
usage = resp.get("usage") or {}
with open(log, "a") as f:
    f.write(json.dumps({"t": int(time.time()), "model": model, **{k: usage.get(k, 0) for k in ("prompt_tokens", "completion_tokens", "total_tokens")}}) + "\n")
print(resp["choices"][0]["message"]["content"].strip())
EOF
