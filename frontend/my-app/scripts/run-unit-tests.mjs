// Runs frontend unit tests without adding a test framework.
//
// Compiles test/unit/*.test.ts with the project's TypeScript into a temp
// directory, then runs the compiled output with node --test.
// Constraint: unit tests must only import dependency-free modules through
// relative imports (e.g. validation, planner). Anything importing
// firebase/* or @/* aliases cannot run here.

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = join(ROOT, "test", "unit");
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");
// Workspace-local build dir (gitignored): works in sandboxes where the
// system temp directory is not writable. Removed after a green run.
const OUT = join(ROOT, ".test-build", "oppcheck-unit-tests");

const testFiles = readdirSync(TEST_DIR)
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => join("test", "unit", name));

if (testFiles.length === 0) {
  console.error("No unit tests found in test/unit.");
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const compile = spawnSync(
  process.execPath,
  [
    TSC,
    ...testFiles,
    "--outDir",
    OUT,
    "--rootDir",
    ".",
    "--module",
    "commonjs",
    "--target",
    "es2022",
    "--moduleResolution",
    "node",
    "--esModuleInterop",
    "--skipLibCheck",
    "--strict",
    "--declaration",
    "false",
    "--sourceMap",
    "false",
  ],
  { cwd: ROOT, stdio: "inherit" },
);
if (compile.status !== 0) {
  process.exit(compile.status ?? 1);
}

const compiled = readdirSync(join(OUT, "test", "unit"))
  .filter((name) => name.endsWith(".test.js"))
  .map((name) => join(OUT, "test", "unit", name));

const run = spawnSync(process.execPath, ["--test", ...compiled], {
  cwd: ROOT,
  stdio: "inherit",
});
if (run.status === 0) {
  rmSync(OUT, { recursive: true, force: true });
} else {
  console.error(`Unit test output kept at: ${OUT}`);
}
process.exit(run.status ?? 1);
