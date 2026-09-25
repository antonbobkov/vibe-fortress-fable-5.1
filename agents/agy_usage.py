"""Print Antigravity CLI quota (5-hour and weekly, per model group) as JSON.

agy has no headless way to report quota, so this drives the interactive TUI in a
Windows pseudo-terminal, types /usage, and parses the panel. Read-only; it
spends no model tokens. Needs `pip install pywinpty`, and agy must already be
signed in and have trusted the folder (it aborts instead of answering the
first-run trust / theme / terms prompts).

    python agents/agy_usage.py
"""
import json
import os
import re
import shutil
import sys
import threading
import time

from winpty import PtyProcess

ANSI = re.compile(r"\x1b\[[0-9;?<>=]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][0-9A-B]|\x1b[=>MN78]")
PROMPTS = ("Do you trust the contents", "Choose your color scheme", "Terms of Service")
AGY = shutil.which("agy") or os.path.join(os.environ["LOCALAPPDATA"], "agy", "bin", "agy.exe")
CWD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

proc = PtyProcess.spawn([AGY.replace("\\", "/")], cwd=CWD, dimensions=(60, 140))
raw = []


def reader():
    while True:
        try:
            chunk = proc.read(4096)
        except EOFError:
            return
        if chunk:
            raw.append(chunk)


threading.Thread(target=reader, daemon=True).start()


def screen():
    text = ANSI.sub("", "".join(raw)).replace("\r", "\n")
    return "\n".join(l.rstrip() for l in text.split("\n") if l.strip())


def finish(code):
    if proc.isalive():
        proc.terminate(force=True)
    sys.exit(code)


time.sleep(7)
if any(p in screen() for p in PROMPTS):
    print("agy is showing a first-run prompt; run `agy` once yourself to finish it.", file=sys.stderr)
    finish(3)

raw.clear()
proc.write("/usage")
time.sleep(1.5)
proc.write("\r")
for _ in range(30):
    time.sleep(0.5)
    if "Five Hour Limit Remaining" in screen() and "CLAUDE AND GPT" in screen():
        break
time.sleep(0.5)
text = screen()
proc.write("\x1b")
time.sleep(0.5)

WINDOW = r"{name} Limit Remaining\s*\[[^\]]*\]\s*([\d.]+)%\s*(Refreshes in [^\n]+|Quota available)"
result = {"account": (re.search(r"Account:\s*(\S+)", text) or [None, None])[1], "groups": {}}
for title, body in re.findall(r"([A-Z][A-Z ]+ MODELS)\n(.*?)(?=\n[A-Z][A-Z ]+ MODELS|\Z)", text, re.S):
    group = {}
    for key, name in (("weekly", "Weekly"), ("five_hour", "Five Hour")):
        m = re.search(WINDOW.format(name=name), body)
        if m:
            group[key] = {"remaining_percent": float(m.group(1)), "refresh": m.group(2).strip()}
    result["groups"][title.title()] = group

print(json.dumps(result, indent=2))
finish(0 if result["groups"] else 1)
