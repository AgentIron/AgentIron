#!/usr/bin/env node
/**
 * Stage the headless runner as a Tauri sidecar.
 *
 * `agentiron-run` is a second binary in the same crate, so `cargo build` has
 * already produced it by the time this runs. Tauri only bundles binaries it
 * knows about, though, and it looks them up by the target-triple naming scheme
 * `name-<triple><ext>`. This copies the compiled runner to that name so the
 * `externalBin` entry resolves.
 *
 * Runs from `beforeBundleCommand`, which fires after the cargo build and before
 * bundler settings are constructed. Hooking the earlier `beforeBuildCommand`
 * would mean compiling the runner ourselves, duplicating the whole iron-core
 * build into a second target directory.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = "agentiron-run";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(repoRoot, "src-tauri");

/** The triple Tauri is building for, which is what it will look the sidecar up by. */
function targetTriple() {
  const fromTauri = process.env.TAURI_ENV_TARGET_TRIPLE;
  if (fromTauri) return fromTauri;

  // Not invoked through Tauri (or a Tauri version that omits the variable), so
  // fall back to the host triple the same way cargo would resolve it.
  const output = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const host = output.match(/^host:\s*(\S+)$/m);
  if (!host) throw new Error("could not determine host target triple from `rustc -vV`");
  return host[1];
}

const triple = targetTriple();
const isWindows = triple.includes("windows");
const ext = isWindows ? ".exe" : "";
const profile = process.env.TAURI_ENV_DEBUG === "true" ? "debug" : "release";

// Tauri passes --target only sometimes, and cargo nests the output under the
// triple when it does, so accept either layout.
const targetDir = process.env.CARGO_TARGET_DIR
  ? resolve(process.env.CARGO_TARGET_DIR)
  : join(tauriDir, "target");

const candidates = [
  join(targetDir, triple, profile, `${BIN}${ext}`),
  join(targetDir, profile, `${BIN}${ext}`),
];

const source = candidates.find((p) => existsSync(p));
if (!source) {
  console.error(`[stage-sidecar] could not find a compiled ${BIN}${ext}. Looked in:`);
  for (const c of candidates) console.error(`  ${c}`);
  process.exit(1);
}

const destDir = join(tauriDir, "binaries");
const dest = join(destDir, `${BIN}-${triple}${ext}`);

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);

console.log(`[stage-sidecar] ${source} -> ${dest}`);
