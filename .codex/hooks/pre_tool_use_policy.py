#!/usr/bin/env python3
"""PreToolUse policy guard for Bejewely Codex sessions.

The script is intentionally defensive: policy failures block with exit code 2,
warnings print to stderr and allow the tool, and hook bugs allow the tool.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import PurePosixPath
from typing import Any, Iterable


BLOCK_EXIT_CODE = 2

PROTECTED_ENV_PATHS = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    "crawler/.env",
}

SECRET_LIKE_PATTERNS = [
    "service_role",
    "SUPABASE_SERVICE_ROLE",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "sk-",
    "sb_secret_",
]

CLIENT_SERVICE_ROLE_PATTERNS = [
    "supabase-admin",
    "service_role",
    "SUPABASE_SERVICE_ROLE_KEY",
]

HIGH_RISK_PATH_PATTERNS = [
    re.compile(r"^supabase/migrations(?:/|$)", re.IGNORECASE),
    re.compile(r"^package\.json$", re.IGNORECASE),
    re.compile(r"^package-lock\.json$", re.IGNORECASE),
    re.compile(r"^next\.config\.js$", re.IGNORECASE),
    re.compile(r"^middleware\.js$", re.IGNORECASE),
    re.compile(r"^app/api(?:/|$)", re.IGNORECASE),
    re.compile(r"^lib/supabase(?:/|\.|-|$)", re.IGNORECASE),
    re.compile(r"^lib/recommendation[^/]*$", re.IGNORECASE),
    re.compile(r"^lib/skin-match-decision-engine\.js$", re.IGNORECASE),
    re.compile(r"^lib/product-source\.js$", re.IGNORECASE),
]

MAIN_BRANCH_FEATURE_PATH_PATTERNS = [
    re.compile(r"^app(?:/|$)", re.IGNORECASE),
    re.compile(r"^components(?:/|$)", re.IGNORECASE),
    re.compile(r"^lib(?:/|$)", re.IGNORECASE),
    re.compile(r"^supabase(?:/|$)", re.IGNORECASE),
    re.compile(r"^package(?:-lock)?\.json$", re.IGNORECASE),
    re.compile(r"^next\.config\.js$", re.IGNORECASE),
    re.compile(r"^middleware\.js$", re.IGNORECASE),
]

PATH_FIELD_NAMES = {
    "file",
    "file_path",
    "filename",
    "path",
    "target",
    "target_file",
}


def normalize_path(value: str) -> str:
    path = value.strip().strip("\"'")
    path = path.replace("\\", "/")
    while path.startswith("./"):
        path = path[2:]
    return str(PurePosixPath(path)).lstrip("/")


def iter_strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from iter_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from iter_strings(item)


def iter_paths_from_fields(value: Any) -> Iterable[str]:
    if isinstance(value, dict):
        for key, item in value.items():
            if key in PATH_FIELD_NAMES and isinstance(item, str):
                yield normalize_path(item)
            yield from iter_paths_from_fields(item)
    elif isinstance(value, list):
        for item in value:
            yield from iter_paths_from_fields(item)


def infer_paths_from_text(text: str) -> Iterable[str]:
    for env_path in PROTECTED_ENV_PATHS:
        if re.search(rf"(^|[\s\"'`=:/\\]){re.escape(env_path)}($|[\s\"'`])", text):
            yield env_path

    path_like = re.findall(
        r"(?:^|[\s\"'`])((?:app|components|lib|supabase|crawler|scripts|\.codex)/[^\s\"'`]+|package\.json|package-lock\.json|next\.config\.js|middleware\.js)",
        text,
    )
    for path in path_like:
        yield normalize_path(path)


def collect_paths(payload: dict[str, Any]) -> set[str]:
    paths = {path for path in iter_paths_from_fields(payload) if path}
    for text in iter_strings(payload):
        paths.update(path for path in infer_paths_from_text(text) if path)
    return paths


def get_tool_name(payload: dict[str, Any]) -> str:
    for key in ("tool_name", "tool", "name"):
        value = payload.get(key)
        if isinstance(value, str):
            return value
    return ""


def get_tool_input(payload: dict[str, Any]) -> Any:
    for key in ("tool_input", "input", "arguments", "args", "parameters"):
        if key in payload:
            return payload[key]
    return payload


def get_command_text(payload: dict[str, Any]) -> str:
    tool_input = get_tool_input(payload)
    if isinstance(tool_input, dict):
        for key in ("command", "cmd", "script", "shell_command"):
            value = tool_input.get(key)
            if isinstance(value, str):
                return value
    return "\n".join(iter_strings(tool_input))


def has_any(text: str, patterns: Iterable[str], *, case_sensitive: bool = False) -> str | None:
    haystack = text if case_sensitive else text.lower()
    for pattern in patterns:
        needle = pattern if case_sensitive else pattern.lower()
        if needle in haystack:
            return pattern
    return None


def path_matches(path: str, patterns: Iterable[re.Pattern[str]]) -> bool:
    normalized = normalize_path(path)
    return any(pattern.search(normalized) for pattern in patterns)


def is_client_exposure_path(path: str) -> bool:
    normalized = normalize_path(path)
    if normalized.startswith("components/"):
        return True
    if not normalized.startswith("app/"):
        return False
    name = normalized.rsplit("/", 1)[-1]
    return bool(
        re.match(r"page\.[^.]+$", name, re.IGNORECASE)
        or re.match(r"client\.[^.]+$", name, re.IGNORECASE)
    )


def get_current_branch() -> str:
    try:
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=os.getcwd(),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=3,
            check=False,
        )
        return result.stdout.strip()
    except Exception:
        return ""


def command_blocks(command: str) -> list[str]:
    lower = command.lower()
    reasons: list[str] = []

    if re.search(r"\brm\s+-[^\n;|&]*r[^\n;|&]*f|\brm\s+-[^\n;|&]*f[^\n;|&]*r", lower):
        reasons.append("Blocked destructive command: rm -rf")
    if re.search(r"\bdrop\s+table\b", command, re.IGNORECASE):
        reasons.append("Blocked destructive SQL: DROP TABLE")
    if re.search(r"\bdrop\s+schema\b", command, re.IGNORECASE):
        reasons.append("Blocked destructive SQL: DROP SCHEMA")
    if re.search(r"\btruncate\s+table\b", command, re.IGNORECASE):
        reasons.append("Blocked destructive SQL: TRUNCATE TABLE")
    if re.search(r"\bsupabase\s+db\s+push\b", lower):
        reasons.append("Blocked direct Supabase DB push")

    production_db_command = (
        re.search(r"\b(prod|production)\b", lower)
        and re.search(r"\b(psql|supabase|database|db)\b", lower)
        and re.search(
            r"\b(alter|create|delete|drop|insert|migrate|migration|push|truncate|update)\b",
            lower,
        )
    )
    if production_db_command:
        reasons.append("Blocked command that looks like a production DB mutation")

    return reasons


def command_warnings(command: str) -> list[str]:
    if re.search(r"\bgit\s+(merge|rebase|pull|push)\b", command, re.IGNORECASE):
        return [
            "Warn: git sync/merge command detected. Check current branch, diff vs main, high-risk files, git diff --check, npm run build, and manual QA/Playwright if needed."
        ]
    return []


def policy_check(payload: dict[str, Any]) -> tuple[list[str], list[str]]:
    tool_name = get_tool_name(payload)
    tool_input = get_tool_input(payload)
    command = get_command_text(payload)
    all_text = "\n".join(iter_strings(tool_input))
    paths = collect_paths(payload)
    blocks: list[str] = []
    warnings: list[str] = []

    for path in sorted(paths):
        if normalize_path(path) in PROTECTED_ENV_PATHS:
            blocks.append(f"Blocked protected env file access or edit: {path}")

    secret_match = has_any(all_text, SECRET_LIKE_PATTERNS, case_sensitive=False)
    if secret_match:
        blocks.append(f"Blocked secret-like token in tool input: {secret_match}")

    client_secret_match = has_any(all_text, CLIENT_SERVICE_ROLE_PATTERNS, case_sensitive=False)
    if client_secret_match and any(is_client_exposure_path(path) for path in paths):
        blocks.append(
            f"Blocked client-side service-role exposure near: {client_secret_match}"
        )

    if tool_name.lower() in {"bash", "shell", "shell_command"} or command:
        blocks.extend(command_blocks(command))
        warnings.extend(command_warnings(command))

    high_risk_paths = sorted(
        path for path in paths if path_matches(path, HIGH_RISK_PATH_PATTERNS)
    )
    if high_risk_paths:
        warnings.append("Warn: high-risk file change detected: " + ", ".join(high_risk_paths))

    branch = get_current_branch()
    main_branch_feature_paths = sorted(
        path for path in paths if path_matches(path, MAIN_BRANCH_FEATURE_PATH_PATTERNS)
    )
    if branch == "main" and main_branch_feature_paths:
        warnings.append(
            "Warn: editing feature/DB/API-related files on main: "
            + ", ".join(main_branch_feature_paths)
        )

    return blocks, warnings


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        if not isinstance(payload, dict):
            return 0

        blocks, warnings = policy_check(payload)
        if blocks:
            for reason in blocks:
                print(reason, file=sys.stderr)
            return BLOCK_EXIT_CODE

        for warning in warnings:
            print(warning, file=sys.stderr)
        return 0
    except Exception as error:
        print(f"Warn: hook policy failed open: {error}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
