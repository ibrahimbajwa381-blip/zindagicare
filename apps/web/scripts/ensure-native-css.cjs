/**
 * Vercel/npm workspaces: platform binaries for lightningcss are often hoisted to the
 * monorepo root while lightningcss itself stays under apps/web/node_modules.
 * lightningcss then fails to require('lightningcss-linux-x64-gnu').
 * Fix: copy the .node binary next to every lightningcss package (fallback path in index.js).
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const appRoot = path.join(__dirname, "..");
const repoRoot = path.join(appRoot, "../..");

if (process.platform !== "linux") {
  process.exit(0);
}

let libc = "gnu";
try {
  const { MUSL, familySync } = require("detect-libc");
  if (familySync() === MUSL) {
    libc = "musl";
  }
} catch {
  // Vercel default images use glibc (gnu)
}

const arch = process.arch;
const platformPkg = `lightningcss-linux-${arch}-${libc}`;
const nodeFileName = `lightningcss.linux-${arch}-${libc}.node`;

function exists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function platformDirFrom(root) {
  const dir = path.join(root, "node_modules", platformPkg);
  if (exists(path.join(dir, nodeFileName))) {
    return dir;
  }
  return null;
}

function findPlatformDir() {
  return platformDirFrom(appRoot) ?? platformDirFrom(repoRoot);
}

function installPlatformPackage() {
  console.log(`[ensure-native-css] Installing ${platformPkg} into apps/web…`);
  execSync(`npm install --no-save --force ${platformPkg}@1.32.0`, {
    cwd: appRoot,
    stdio: "inherit",
  });
}

function lightningcssDirs() {
  const dirs = [];
  for (const root of [appRoot, repoRoot]) {
    const dir = path.join(root, "node_modules", "lightningcss");
    if (exists(path.join(dir, "node", "index.js"))) {
      dirs.push(dir);
    }
  }
  return [...new Set(dirs)];
}

let platformDir = findPlatformDir();
if (!platformDir) {
  installPlatformPackage();
  platformDir = findPlatformDir();
}

const src = platformDir ? path.join(platformDir, nodeFileName) : null;
if (!src || !exists(src)) {
  console.error(
    `[ensure-native-css] Missing native binary ${nodeFileName}. Checked apps/web and repo root.`,
  );
  process.exit(1);
}

const targets = lightningcssDirs();
if (targets.length === 0) {
  console.error("[ensure-native-css] No lightningcss package directory found.");
  process.exit(1);
}

for (const dir of targets) {
  const dest = path.join(dir, nodeFileName);
  fs.copyFileSync(src, dest);
  console.log(`[ensure-native-css] Copied ${nodeFileName} -> ${dest}`);
}
