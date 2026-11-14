#!/usr/bin/env python3
"""UI proof - a PR that changes what a user sees must carry BEFORE and AFTER screenshots.

The user-visible paths come
from .github/ui-proof.json ({"ui_patterns": [...], "exempt_bases": [...]}).

Satisfied by ANY of:
  * the PR body section "## Screenshots BEFORE / AFTER" holds >=1 BEFORE and >=1 AFTER
    image or video (markdown image, <img>/<video>, github user-attachments URL, link to
    png/jpg/gif/webp/mp4/webm/mov);
  * the PR itself commits images (docs/screenshots/<pr>/before-*.png + after-*.png);
  * the sticky auto-capture comment from github-actions[bot] (marker "<!-- ui-shots:pairs=N")
    holds at least one pair;
  * label `no-visual-change` AND a written reason (>=10 chars) in that same section.

Exempt: dependabot, PRs touching no user-visible path, bases listed in exempt_bases,
head branches starting with a prefix in exempt_head_prefixes.
State is read from the GitHub API at run time (the workflow re-runs on body/label edits).
Fails closed when the API cannot be read.

    GITHUB_TOKEN=... python scripts/check_ui_proof.py --repo owner/name --pr 12
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

LABEL = "no-visual-change"
BOT_LOGINS = {"github-actions[bot]"}
IMG_EXT = re.compile(r"\.(png|jpe?g|gif|webp|mp4|webm|mov)$", re.I)
SECTION_RE = re.compile(
    r"^(#{2,3})[ \t]*(?:screenshots|скриншоты|до[ \t]*/[ \t]*после|before[ \t]*/[ \t]*after)\b.*$",
    re.I | re.M,
)
DEFAULT_PATTERNS = ["src/**", "app/**", "components/**", "pages/**", "public/**", "**/*.tsx", "**/*.jsx", "**/*.css", "**/*.html"]
NOT_UI = [
    re.compile(r"(^|/)(test|tests|__tests__|__mocks__|e2e|\.maestro)/"),
    re.compile(r"\.(test|spec)\.[cm]?[jt]sx?$"),
    re.compile(r"\.md$"),
    re.compile(r"^docs/screenshots/"),
]
_MEDIA_URL = re.compile(
    r"(/user-attachments/(assets|files)/|user-images\.githubusercontent\.com/"
    r"|\.(png|jpe?g|gif|webp|mp4|webm|mov)(\?[^\s)\"'<>]*)?$)", re.I)
_MD_IMAGE = re.compile(r"!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)")
_HTML_MEDIA = re.compile(r"<(?:img|video|source)\b[^>]*?\bsrc\s*=\s*[\"']([^\"']+)[\"'][^>]*>", re.I)
_MD_LINK = re.compile(r"(?<!!)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)")
_BARE_URL = re.compile(r"https?://[^\s)\"'<>|]+")
_COMMENT = re.compile(r"<!--.*?-->", re.S)
_BEFORE = re.compile(r"(?<![\w-])(до|было|before|was)(?![\w-])", re.I)
_AFTER = re.compile(r"(?<![\w-])(после|стало|after|now)(?![\w-])", re.I)
_BEFORE_FILE = re.compile(r"before|(^|[/_-])was([._-]|$)", re.I)
_AFTER_FILE = re.compile(r"after|(^|[/_-])now([._-]|$)", re.I)


def load_config(path: str = ".github/ui-proof.json") -> dict:
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return {}


def is_ui_path(path: str, patterns: list[str]) -> bool:
    if any(p.search(path) for p in NOT_UI):
        return False
    return any(fnmatch.fnmatchcase(path, pat) or (pat.startswith("**/") and fnmatch.fnmatchcase(path, pat[3:])) for pat in patterns)


def section(body: str) -> str | None:
    body = (body or "").replace("\r\n", "\n")
    m = SECTION_RE.search(body)
    if not m:
        return None
    level = len(m.group(1))
    rest = body[m.end():]
    end = re.search(r"^#{1,%d}\s" % level, rest, re.M)
    return _COMMENT.sub("", rest[: end.start()] if end else rest)


def _side_from_text(text: str) -> str | None:
    b, a = bool(_BEFORE.search(text)), bool(_AFTER.search(text))
    if b != a:
        return "before" if b else "after"
    return None


def _side_from_url(url: str) -> str | None:
    name = url.split("?")[0].rsplit("/", 1)[-1]
    b, a = bool(_BEFORE_FILE.search(name)), bool(_AFTER_FILE.search(name))
    if b != a:
        return "before" if b else "after"
    return None


def _media_in(text: str) -> list[tuple[int, str, str]]:
    found: dict[str, tuple[int, str, str]] = {}
    spans: list[tuple[int, int]] = []

    def add(pos, url, alt, span):
        spans.append(span)
        found.setdefault(url, (pos, url, alt))

    for m in _MD_IMAGE.finditer(text):
        add(m.start(), m.group(2), m.group(1), m.span())
    for m in _HTML_MEDIA.finditer(text):
        alt = re.search(r"\balt\s*=\s*[\"']([^\"']*)", m.group(0), re.I)
        add(m.start(), m.group(1), alt.group(1) if alt else "", m.span())
    for m in _MD_LINK.finditer(text):
        if _MEDIA_URL.search(m.group(2)):
            add(m.start(), m.group(2), m.group(1), m.span())
    for m in _BARE_URL.finditer(text):
        if any(s <= m.start() < e for s, e in spans):
            continue
        if _MEDIA_URL.search(m.group(0)):
            add(m.start(), m.group(0), "", m.span())
    return sorted(found.values())


def _cells(line: str) -> list[str]:
    s = line.strip()
    s = s[1:] if s.startswith("|") else s
    s = s[:-1] if s.endswith("|") else s
    return s.split("|")


def classify_media(sec: str) -> tuple[int, int, int]:
    before = after = unknown = 0
    seen: set[str] = set()
    header = None
    for line in sec.split("\n"):
        stripped = line.strip()
        in_table = stripped.startswith("|") and stripped.count("|") >= 2
        if not in_table:
            header = None
        media = _media_in(line)
        if in_table and not media:
            if re.fullmatch(r"[\s|:\-]+", stripped):
                continue
            sides = [_side_from_text(c) for c in _cells(stripped)]
            if any(sides):
                header = sides
            continue
        for _pos, url, alt in media:
            if url in seen:
                continue
            seen.add(url)
            side = None
            if in_table and header:
                col = line[: line.find(url)].strip().lstrip("|").count("|")
                if col < len(header):
                    side = header[col]
            if side is None:
                side = _side_from_text(alt) or _side_from_url(url)
            if side is None:
                pre = _MD_IMAGE.sub("", _HTML_MEDIA.sub("", line[: line.find(url)]))
                side = _side_from_text(pre)
            if side == "before":
                before += 1
            elif side == "after":
                after += 1
            else:
                unknown += 1
    return before, after, unknown


def media_ok(sec: str) -> tuple[bool, str]:
    b, a, u = classify_media(sec)
    ok = (b + u >= 1) and (a + u >= 1) and (b + a + u >= 2)
    return ok, f"BEFORE: {b}, AFTER: {a}, unlabelled: {u}"


def reason_text(sec: str) -> str:
    out = []
    for line in sec.split("\n"):
        s = line.strip()
        if not s or re.fullmatch(r"[\s|:\-]+", s):
            continue
        if s.startswith("|"):
            cells = [c.strip() for c in _cells(s)]
            if all(not c or _side_from_text(c) for c in cells):
                continue
            s = " ".join(c for c in cells if c)
        out.append(s)
    return " ".join(out).strip()


def bot_pairs(comments: list[dict]) -> int:
    best = 0
    for c in comments:
        if (c.get("user") or {}).get("login") not in BOT_LOGINS:
            continue
        m = re.search(r"<!-- ui-shots:pairs=(\d+)", c.get("body") or "")
        if m:
            best = max(best, int(m.group(1)))
    return best


def committed_images(files: list[str]) -> tuple[int, int, int]:
    b = a = u = 0
    for f in files:
        if not IMG_EXT.search(f) or not re.search(r"(^|/)(docs/)?(screenshots|shots)/", f):
            continue
        side = _side_from_url(f)
        if side == "before":
            b += 1
        elif side == "after":
            a += 1
        else:
            u += 1
    return b, a, u


def evaluate(*, files, body, labels, comments, base_ref, author, cfg, label_actor=None, head_ref=""):
    if base_ref in cfg.get("exempt_bases", []):
        return True, [f"Base `{base_ref}` is exempt."]
    if author.startswith(("dependabot", "renovate")):
        return True, ["bot author - not applicable."]
    for pre in cfg.get("exempt_head_prefixes", []):
        if head_ref.startswith(pre):
            return True, [f"Branch `{head_ref}` is exempt (reviewed through its own preview flow)."]
    patterns = cfg.get("ui_patterns") or DEFAULT_PATTERNS
    ui = [f for f in files if is_ui_path(f, patterns)]
    if not ui:
        return True, ["No user-visible files changed - screenshots not needed."]
    lines = [f"User-visible files changed: {len(ui)}"] + [f"  {f}" for f in ui[:20]]
    if len(ui) > 20:
        lines.append(f"  ... and {len(ui) - 20} more")
    sec = section(body)
    if sec is not None:
        ok, counts = media_ok(sec)
        lines.append(f"Section 'Screenshots BEFORE / AFTER': {counts}")
        if ok:
            return True, lines + ["OK: BEFORE and AFTER in the PR description."]
    else:
        lines.append("PR description has no '## Screenshots BEFORE / AFTER' section (.github/pull_request_template.md).")
    b, a, u = committed_images(files)
    if (b + u >= 1) and (a + u >= 1) and (b + a + u >= 2):
        return True, lines + [f"OK: screenshots committed in the PR (before {b}, after {a}, unlabelled {u})."]
    pairs = bot_pairs(comments)
    if pairs:
        return True, lines + [f"OK: auto-captured screenshots from the bot comment - pairs: {pairs}."]
    if LABEL in labels:
        reason = reason_text(sec or "")
        who = label_actor or "unknown"
        if len(re.sub(r"[^\w]", "", reason)) >= 10:
            return True, lines + [f"OK: label `{LABEL}` (by {who}). Reason: {reason[:300]}"]
        return False, lines + [f"Label `{LABEL}` is set (by {who}) but the Screenshots section has no one-line reason."]
    return False, lines + [
        "FAIL: BEFORE and AFTER screenshots/video are required. Options:",
        "  1) paste BEFORE and AFTER images into the 'Screenshots BEFORE / AFTER' section of the PR description;",
        "  2) commit them under docs/screenshots/<pr>/ (before-*.png, after-*.png);",
        f"  3) nothing visible changes -> label `{LABEL}` + a one-line reason in that section.",
        "Editing the description or label re-runs this check; no new commit needed.",
    ]


def api(url: str, token: str):
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"})
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read() or b"null"), r.headers.get("Link", "")
        except urllib.error.HTTPError as e:
            if e.code < 500:
                raise RuntimeError(f"GitHub API {url}: HTTP {e.code}") from e
            last = e
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"GitHub API {url}: {last}")


def paged(url: str, token: str) -> list:
    out: list = []
    while url:
        data, link = api(url, token)
        out.extend(data)
        m = re.search(r'<([^>]+)>;\s*rel="next"', link)
        url = m.group(1) if m else ""
    return out


def fetch(repo: str, pr: int, token: str, api_url: str) -> dict:
    base = f"{api_url}/repos/{repo}"
    p, _ = api(f"{base}/pulls/{pr}", token)
    labels = [lb["name"] for lb in p.get("labels", [])]
    actor = None
    if LABEL in labels:
        for ev in paged(f"{base}/issues/{pr}/events?per_page=100", token):
            if ev.get("event") == "labeled" and (ev.get("label") or {}).get("name") == LABEL:
                actor = (ev.get("actor") or {}).get("login")
    return {
        "files": [f["filename"] for f in paged(f"{base}/pulls/{pr}/files?per_page=100", token)],
        "body": p.get("body") or "",
        "labels": labels,
        "comments": paged(f"{base}/issues/{pr}/comments?per_page=100", token),
        "base_ref": p["base"]["ref"],
        "author": (p.get("user") or {}).get("login", ""),
        "head_ref": p["head"]["ref"],
        "label_actor": actor,
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--repo", required=True)
    ap.add_argument("--pr", type=int, required=True)
    args = ap.parse_args(argv)
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""
    api_url = os.environ.get("GITHUB_API_URL", "https://api.github.com")
    try:
        state = fetch(args.repo, args.pr, token, api_url)
    except Exception as e:  # fail closed with the reason
        print(f"::error title=UI proof::could not read the PR from the GitHub API: {e}")
        return 1
    ok, lines = evaluate(cfg=load_config(), **state)
    text = "\n".join(lines)
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(f"### UI proof: {'OK' if ok else 'FAIL'}\n\n```\n{text}\n```\n")
    if not ok:
        print("::error title=UI proof::BEFORE/AFTER screenshots missing - see the step log and the PR template")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
