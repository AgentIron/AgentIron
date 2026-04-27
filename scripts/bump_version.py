#!/usr/bin/env python3
"""Bump version across AgentIron's package.json, Cargo.toml, and tauri.conf.json."""

import json
import re
import sys
from pathlib import Path


def bump_semver(version: str, bump_type: str) -> str:
    """Bump a semver version string."""
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)(.*)$", version)
    if not match:
        raise ValueError(f"Invalid semver version: {version}")

    major, minor, patch, suffix = match.groups()
    major, minor, patch = int(major), int(minor), int(patch)

    if bump_type == "major":
        major += 1
        minor = 0
        patch = 0
    elif bump_type == "minor":
        minor += 1
        patch = 0
    elif bump_type == "patch":
        patch += 1
    else:
        raise ValueError(f"Unknown bump type: {bump_type}")

    return f"{major}.{minor}.{patch}{suffix}"


def bump_package_json(path: Path, new_version: str) -> None:
    """Update version in package.json."""
    data = json.loads(path.read_text())
    data["version"] = new_version
    path.write_text(json.dumps(data, indent=2) + "\n")


def bump_cargo_toml(path: Path, new_version: str) -> None:
    """Update version in Cargo.toml."""
    content = path.read_text()
    # Replace version = "x.y.z" under [package]
    content = re.sub(
        r'^(\s*version\s*=\s*")[^"]+("\s*)$',
        rf'\g<1>{new_version}\g<2>',
        content,
        flags=re.MULTILINE,
    )
    path.write_text(content)


def bump_tauri_conf(path: Path, new_version: str) -> None:
    """Update version in tauri.conf.json."""
    data = json.loads(path.read_text())
    data["version"] = new_version
    path.write_text(json.dumps(data, indent=2) + "\n")


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ("patch", "minor", "major"):
        print(f"Usage: {sys.argv[0]} <patch|minor|major>")
        return 1

    bump_type = sys.argv[1]
    repo_root = Path(__file__).parent.parent

    # Read current version from package.json
    package_json = repo_root / "package.json"
    current_version = json.loads(package_json.read_text())["version"]
    new_version = bump_semver(current_version, bump_type)

    # Bump all files
    bump_package_json(package_json, new_version)
    bump_cargo_toml(repo_root / "src-tauri" / "Cargo.toml", new_version)
    bump_tauri_conf(repo_root / "src-tauri" / "tauri.conf.json", new_version)

    print(new_version)
    return 0


if __name__ == "__main__":
    sys.exit(main())
