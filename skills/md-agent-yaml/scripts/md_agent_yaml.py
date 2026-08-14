#!/usr/bin/env python3
"""md-agent sidecar helper.

convert   create missing {stem}.agent.yaml stubs (does not overwrite)
check     print durable markdown missing a sidecar, and .readme.yaml drift
check-stop
          Stop-hook mode: remind once if this turn left durable markdown
          without a sidecar, or (opt-in) a .readme.yaml map gap.
          Always exit 0 (fail-open).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

SCHEMA = "md-agent/v1"
SIDECAR_SUFFIX = ".agent.yaml"
README_MAP = ".readme.yaml"
COMPONENT_FILES = {"package.json", "cargo.toml", "pyproject.toml", "go.mod"}
COMPONENT_SUFFIXES = {".csproj", ".sln"}
MAP_SECTIONS = {"children", "apps", "packages"}
INDEX_NOISE_DIRS = {
    "docs",
    "doc",
    "plans",
    "plan",
    "skills",
    "handoffs",
    "handoff",
    ".github",
    "coverage",
    "tests",
    "test",
    "scripts",
}

EXCLUDE_DIR_NAMES = {
    ".git",
    "node_modules",
    "vendor",
    "dist",
    "build",
    "artifacts",
    ".next",
    ".nuget",
    "bin",
    "obj",
    "worktrees",
    "coverage",
    "lcov-report",
    "__pycache__",
    ".venv",
    "venv",
}

EXCLUDE_PATH_PARTS = (
    "/.git/",
    "/.claude/",
    "/.grok/",
    "/.agents/",
    "/.cursor/",
    "/plans/",
    "/plan/",
    "/skills/",
    "/handoffs/",
    "/handoff/",
    "/node_modules/",
    "/vendor/",
    "/worktrees/",
)

EXCLUDE_NAMES = {
    "claude.md",
    "agents.md",
    "changelog.md",
    "license.md",
    "contributing.md",
    "code_of_conduct.md",
    "security.md",
}

FRONTMATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.DOTALL)
HEADING_RE = re.compile(r"^#{1,6}\s+(.*\S)\s*$", re.MULTILINE)
LIST_RE = re.compile(r"^[-*+]\s+(.*\S)\s*$", re.MULTILINE)


def posix(path: Path) -> str:
    return path.as_posix()


def git_root(start: Path) -> Path | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(start), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None
    if result.returncode != 0:
        return None
    return Path(result.stdout.strip())


def repo_rel(path: Path, root: Path | None) -> str:
    resolved = path.resolve()
    if root:
        try:
            return posix(resolved.relative_to(root.resolve()))
        except ValueError:
            pass
    return path.name


def is_excluded_dir(path: Path) -> bool:
    if any(part in EXCLUDE_DIR_NAMES for part in path.parts):
        return True
    lowered = f"/{posix(path).lower()}/"
    return any(part in lowered for part in EXCLUDE_PATH_PARTS)


def is_durable_markdown(path: Path) -> bool:
    if path.suffix.lower() != ".md":
        return False
    if path.name.lower() in EXCLUDE_NAMES:
        return False
    if is_excluded_dir(path.parent):
        return False
    name = path.name.lower()
    if name == "readme.md":
        return True
    parts_lower = {part.lower() for part in path.parts}
    if parts_lower & {"docs", "doc", "adr", "adrs", "specs", "spec"}:
        return True
    stem = path.stem.upper()
    return stem.startswith("ADR-") or stem.startswith("SPEC-") or stem.startswith("PRD-")


def sidecar_for(md_path: Path) -> Path:
    return md_path.with_name(md_path.stem + SIDECAR_SUFFIX)


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def emit_sidecar(payload: dict) -> str:
    facts = payload.get("facts") or []
    if facts:
        facts_block = "\n".join(f"  - {yaml_string(item)}" for item in facts)
    else:
        facts_block = "  []"
    audience = payload.get("audience") or ["agent"]
    audience_block = "[" + ", ".join(yaml_string(item) for item in audience) + "]"
    return (
        f"schema: {SCHEMA}\n"
        f"source: {payload['source']}\n"
        f"title: {yaml_string(payload['title'])}\n"
        f"purpose: {yaml_string(payload['purpose'])}\n"
        f"audience: {audience_block}\n"
        f"facts:\n{facts_block}\n"
        f"last_synced: {payload['last_synced']}\n"
    )


def strip_frontmatter(text: str) -> str:
    return FRONTMATTER_RE.sub("", text, count=1)


def first_paragraph(text: str) -> str:
    chunks: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            if chunks:
                break
            continue
        if line.startswith("#") or line.startswith("```") or line.startswith(">"):
            if chunks:
                break
            continue
        if line.startswith("|") or line.startswith("- ") or line.startswith("* "):
            if chunks:
                break
            continue
        chunks.append(line)
    return " ".join(chunks).strip()


def extract_from_markdown(md_path: Path, root: Path | None) -> dict:
    text = md_path.read_text(encoding="utf-8", errors="replace")
    body = strip_frontmatter(text)
    heading = HEADING_RE.search(body)
    title = heading.group(1).strip() if heading else md_path.stem.replace("-", " ")
    purpose = first_paragraph(body)
    if not purpose:
        purpose = f"Agent sidecar for {md_path.name}."
    facts = [item.strip() for item in LIST_RE.findall(body) if len(item.strip()) > 8][:8]
    parts_lower = {part.lower() for part in md_path.parts}
    if md_path.name.lower() == "readme.md":
        audience = ["human", "agent"]
    elif parts_lower & {"adr", "adrs", "specs", "spec"}:
        audience = ["agent", "human"]
    else:
        audience = ["agent"]
    return {
        "schema": SCHEMA,
        "source": repo_rel(md_path, root),
        "title": title,
        "purpose": purpose[:400],
        "audience": audience,
        "facts": facts,
        "last_synced": date.today().isoformat(),
    }


def changed_paths(root: Path) -> list[Path]:
    commands = (
        ["git", "-C", str(root), "diff", "--name-only", "--diff-filter=ACMR", "HEAD"],
        ["git", "-C", str(root), "diff", "--name-only", "--cached", "--diff-filter=ACMR"],
        ["git", "-C", str(root), "ls-files", "--others", "--exclude-standard"],
    )
    names: set[str] = set()
    for command in commands:
        try:
            result = subprocess.run(command, capture_output=True, text=True, check=False)
        except OSError:
            continue
        if result.returncode != 0:
            continue
        names.update(line.strip() for line in result.stdout.splitlines() if line.strip())
    return [root / name for name in sorted(names)]


def missing_sidecars(paths: list[Path]) -> list[Path]:
    missing: list[Path] = []
    for path in paths:
        if not path.is_file() or not is_durable_markdown(path):
            continue
        if not sidecar_for(path).is_file():
            missing.append(path)
    return missing


def git_tracked_readme_maps(root: Path) -> list[Path]:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "ls-files", "-z"],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return []
    if result.returncode != 0:
        return []
    maps: list[Path] = []
    for name in result.stdout.split("\0"):
        if name == README_MAP or name.endswith("/" + README_MAP):
            maps.append(root / name)
    return maps


def is_component_signal(path: Path) -> bool:
    name = path.name.lower()
    if name == "readme.md":
        return not ({part.lower() for part in path.parts} & INDEX_NOISE_DIRS)
    if name in COMPONENT_FILES:
        return not is_excluded_dir(path.parent)
    return path.suffix.lower() in COMPONENT_SUFFIXES


def parse_map_lists(text: str) -> tuple[set[str], set[str]]:
    listed: set[str] = set()
    skip: set[str] = set()
    mode: str | None = None
    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" \t"))
        stripped = raw.strip()
        if indent == 0:
            key = stripped.split(":", 1)[0].strip()
            rest = stripped.split(":", 1)[1].strip() if ":" in stripped else ""
            if key in MAP_SECTIONS:
                mode = "children"
                continue
            if key == "skip":
                mode = "skip"
                if rest.startswith("["):
                    skip.update(item.strip(" '\"") for item in rest.strip("[]").split(",") if item.strip())
                    mode = None
                continue
            mode = None
            continue
        if mode == "children":
            match = re.search(r"\b(?:name|path):\s*['\"]?([^'\"#]+)", stripped)
            if match:
                listed.add(match.group(1).strip())
        elif mode == "skip":
            item = stripped[1:].strip() if stripped.startswith("-") else stripped
            item = item.split(":", 1)[-1].strip().strip("'\"")
            if item:
                skip.add(item)
    return listed, skip


def listed_in_map(child: Path, parent: Path, listed: set[str], skip: set[str]) -> bool:
    rel = posix(child.relative_to(parent)) if child != parent else child.name
    names = {child.name, rel, posix(child)}
    if names & skip:
        return True
    return bool(names & listed)


def ancestor_maps(directory: Path, root: Path) -> list[Path]:
    found: list[Path] = []
    current = directory.resolve()
    stop = root.resolve()
    while True:
        candidate = current / README_MAP
        if candidate.is_file():
            found.append(candidate)
        if current == stop or current.parent == current:
            break
        current = current.parent
    return found


def working_readme_maps(root: Path, changed: list[Path]) -> list[Path]:
    maps = git_tracked_readme_maps(root)
    for path in changed:
        if path.name == README_MAP and path.is_file():
            maps.append(path)
    return maps


def map_gaps(changed: list[Path], root: Path) -> tuple[list[Path], list[tuple[Path, str]]]:
    if not working_readme_maps(root, changed):
        return [], []

    missing_cards: list[Path] = []
    stale_parents: list[tuple[Path, str]] = []
    seen_dirs: set[Path] = set()

    for path in changed:
        if not path.exists() or is_excluded_dir(path.parent):
            continue
        if not is_component_signal(path):
            continue
        directory = path.parent.resolve()
        if directory in seen_dirs:
            continue
        seen_dirs.add(directory)
        if (directory / README_MAP).is_file():
            continue

        ancestors = ancestor_maps(directory.parent, root)
        covered = False
        for map_path in ancestors:
            try:
                text = map_path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            listed, skip = parse_map_lists(text)
            parent_dir = map_path.parent
            if listed_in_map(directory, parent_dir, listed, skip):
                covered = True
                break
            if listed:
                stale_parents.append((map_path, repo_rel(directory, root)))
                covered = True
                break
        if not covered:
            missing_cards.append(directory)

    # unique stale pairs
    unique_stale: list[tuple[Path, str]] = []
    seen_pairs: set[tuple[str, str]] = set()
    for map_path, child in stale_parents:
        key = (str(map_path), child)
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        unique_stale.append((map_path, child))
    return missing_cards, unique_stale


def convert_paths(paths: list[Path], root: Path | None) -> list[Path]:
    written: list[Path] = []
    for md_path in paths:
        if not md_path.is_file() or not is_durable_markdown(md_path):
            continue
        sidecar = sidecar_for(md_path)
        if sidecar.exists():
            continue
        sidecar.write_text(emit_sidecar(extract_from_markdown(md_path, root)), encoding="utf-8")
        written.append(sidecar)
    return written


def hook_field(data: dict, *keys: str):
    for key in keys:
        if key in data and data[key] not in (None, ""):
            return data[key]
    return None


def read_hook_input() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def check_stop() -> int:
    data = read_hook_input()
    reason = str(hook_field(data, "reason", "stop_reason") or "end_turn")
    if reason not in {"end_turn", "completed", ""}:
        return 0
    if hook_field(data, "stopHookActive", "stop_hook_active") is True:
        return 0

    cwd_value = hook_field(data, "cwd", "workspaceRoot", "workspace_root") or str(Path.cwd())
    root = git_root(Path(cwd_value))
    if root is None:
        return 0

    changed = changed_paths(root)
    missing = missing_sidecars(changed)
    missing_maps, stale_parents = map_gaps(changed, root)
    if not missing and not missing_maps and not stale_parents:
        return 0

    script = posix(Path(__file__))
    parts: list[str] = []
    if missing:
        parts.append(
            "Durable markdown is missing an md-agent sidecar ({stem}.agent.yaml).\n"
            + "\n".join(f"- {repo_rel(path, root)}" for path in missing)
            + f"\nCreate stubs with: python {script} convert <path>\n"
            "Then fill facts. Do not write these into .readme.yaml."
        )
    if missing_maps:
        parts.append(
            "Component directory has no .readme.yaml exploration map "
            "and is not listed on an ancestor map.\n"
            + "\n".join(f"- {repo_rel(path, root)}" for path in missing_maps)
        )
    if stale_parents:
        parts.append(
            "Ancestor .readme.yaml is missing a new/changed child "
            "(add it to children or skip).\n"
            + "\n".join(
                f"- {repo_rel(map_path, root)} ← {child}"
                for map_path, child in stale_parents
            )
        )
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "Stop",
                    "additionalContext": "\n\n".join(parts),
                }
            }
        )
    )
    return 0


def usage() -> str:
    return (
        "usage: md_agent_yaml.py convert [--repo] [paths...]\n"
        "       md_agent_yaml.py check [--repo] [paths...]\n"
        "       md_agent_yaml.py check-stop"
    )


def collect_targets(args: list[str], root: Path | None) -> list[Path]:
    if "--repo" in args:
        if root is None:
            raise SystemExit("not a git repository")
        found: list[Path] = []
        for path in root.rglob("*.md"):
            if is_durable_markdown(path):
                found.append(path)
        return found
    explicit = [Path(item).resolve() for item in args if item != "--repo"]
    if explicit:
        return explicit
    if root is None:
        return []
    return changed_paths(root)


def main(argv: list[str]) -> int:
    if not argv or argv[0] in {"-h", "--help"}:
        print(usage())
        return 0

    command, *rest = argv
    try:
        if command == "check-stop":
            return check_stop()

        start = Path.cwd()
        root = git_root(start)
        targets = collect_targets(rest, root)

        if command == "convert":
            written = convert_paths(targets, root)
            for path in written:
                print(f"wrote {path}")
            if not written:
                print("no missing sidecars")
            return 0

        if command == "check":
            missing = missing_sidecars(targets)
            for path in missing:
                print(repo_rel(path, root))
            if root is not None:
                missing_maps, stale_parents = map_gaps(
                    targets if targets else changed_paths(root), root
                )
                for path in missing_maps:
                    print(f"map-missing {repo_rel(path, root)}")
                for map_path, child in stale_parents:
                    print(f"map-stale {repo_rel(map_path, root)} <- {child}")
            return 0

        print(usage(), file=sys.stderr)
        return 2
    except Exception:
        if command == "check-stop":
            return 0
        raise


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
