#!/usr/bin/env node
/**
 * Stage the headless runner as a Tauri sidecar.
 *
 * `agentiron-run` is a second binary in the same crate, which makes the
 * ordering awkward. `tauri-build`'s build script checks that every `externalBin`
 * path exists, and that check runs during `cargo build` — the very step that
 * produces the runner. So the file has to exist before the thing that creates
 * it runs, and `cargo build --bin agentiron-run` fails on the same check.
 *
 * This runs twice to break the cycle:
 *
 *   beforeBuildCommand   --ensure   creates an empty placeholder if no runner
 *                                   has been built yet, purely so the build
 *                                   script's existence check passes
 *   beforeBundleCommand             copies the freshly compiled runner over it,
 *                                   before bundler settings are constructed
 *
 * The second call is what actually ships, and it fails loudly if the compiled
 * runner is missing, so a placeholder can never reach a bundle silently.
 *
 * The alternative — compiling the runner ourselves ahead of Tauri — needs a
 * separate target directory or crate and duplicates the whole iron-core build.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = "agentiron-run";
const ensureOnly = process.argv.includes("--ensure");

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(repoRoot, "src-tauri");

/** The triple Tauri builds for, which is what it looks the sidecar up by. */
function targetTriple() {
  const fromTauri = process.env.TAURI_ENV_TARGET_TRIPLE;
  if (fromTauri) return fromTauri;

  // Not invoked through Tauri, so fall back to the host triple as cargo resolves it.
  const output = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const host = output.match(/^host:\s*(\S+)$/m);
  if (!host) throw new Error("could not determine host target triple from `rustc -vV`");
  return host[1];
}

const triple = targetTriple();
const ext = triple.includes("windows") ? ".exe" : "";
const profile = process.env.TAURI_ENV_DEBUG === "true" ? "debug" : "release";

// Tauri passes --target only sometimes, and cargo nests output under the triple
// when it does, so accept either layout.
const targetDir = process.env.CARGO_TARGET_DIR
  ? resolve(process.env.CARGO_TARGET_DIR)
  : join(tauriDir, "target");

const compiled = [
  join(targetDir, triple, profile, `${BIN}${ext}`),
  join(targetDir, profile, `${BIN}${ext}`),
].find((p) => existsSync(p) && statSync(p).size > 0);

const destDir = join(tauriDir, "binaries");
const dest = join(destDir, `${BIN}-${triple}${ext}`);
mkdirSync(destDir, { recursive: true });

if (compiled) {
  copyFileSync(compiled, dest);
  console.log(`[stage-sidecar] ${compiled} -> ${dest}`);
  process.exit(0);
}

if (!ensureOnly) {
  console.error(
    `[stage-sidecar] no compiled ${BIN}${ext} found for ${triple}/${profile}.\n` +
      `  The bundle would ship a placeholder, so refusing to continue.`,
  );
  process.exit(1);
}

// Pre-build pass with nothing compiled yet: leave a placeholder so the build
// script's existence check passes. The beforeBundleCommand pass replaces it.
if (!existsSync(dest)) {
  writeFileSync(dest, "");
  console.log(`[stage-sidecar] placeholder ${dest} (replaced after cargo build)`);
} else {
  console.log(`[stage-sidecar] keeping existing ${dest} for the build-script check`);
}
