# Windows x64 Portable Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a clean Windows 10/11 x64 portable ZIP of the current CherryIN Studio that launches with `Start-Studio.bat`.

**Architecture:** Build the current Next.js application in standalone mode, stage it in an isolated directory, replace any platform-native image dependencies with Windows x64 packages, and add a bundled Windows Node runtime plus a visible launcher. Validate binary formats, data cleanliness, archive integrity, and hashes without claiming Windows runtime execution.

**Tech Stack:** Next.js 16 standalone output, Node.js Windows x64 runtime, npm platform-targeted packages, ZIP/SHA-256 tooling.

## Global Constraints

- Output root is `CherryIN-Studio-Windows-x64` with `Start-Studio.bat`.
- Exclude API keys, history, generated images, logs, PID files, macOS launchers, and macOS native binaries.
- Include empty writable `data/history.json` and `public/generated`.
- Windows native components must identify as PE32+ x86-64; no Mach-O or `.dylib` entries.
- Launcher uses CRLF, keeps errors visible, starts port 3100, and opens the browser.
- Do not run a paid generation.
- Final status remains “Windows static validation passed; real Windows launch pending.”

---

### Task 1: Build and stage current application

**Files:**
- Modify: `next.config.ts` to set `output: "standalone"`.
- Create in temporary workspace: `CherryIN-Studio-Windows-x64/`.

- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Copy `.next/standalone`, `.next/static`, and required `public` assets into isolated staging.
- [ ] Create empty `data/history.json` and empty `public/generated`.
- [ ] Confirm staged code includes the current all-provider concurrency scheduler and refresh recovery logic.

### Task 2: Install Windows runtime and native dependencies

**Files:**
- Create: staged `runtime/node.exe`.
- Replace: staged Windows-targeted Sharp and libvips packages.

- [ ] Extract the previously validated Windows x64 runtime from V3 or obtain an official compatible Windows x64 Node runtime.
- [ ] Install/copy Windows x64 Sharp packages matching the current lockfile.
- [ ] Remove Darwin and Linux optional native packages from staging.
- [ ] Use `file` to confirm Node, Sharp, and libvips binaries are PE32+ x86-64.

### Task 3: Launcher, instructions, and release validation

**Files:**
- Create: `Start-Studio.bat` with CRLF.
- Create: `使用说明.txt`.
- Create: `/Users/xieyingjun/Documents/Codex/2026-08-12/z-2/outputs/CherryIN-Studio-Windows-x64-2026-08-12.zip`.
- Create: matching `.sha256.txt`.

- [ ] Add a visible launcher that resolves its own directory, checks `runtime/node.exe`, starts `server.js` on 3100, waits for readiness, opens the browser, and pauses on failure.
- [ ] Scan staging for `.env`, keys, logs, non-empty history, generated images, Mach-O, `.dylib`, and Darwin packages.
- [ ] Create the ZIP, run archive integrity testing, and generate SHA-256.
- [ ] List final size and validation evidence, explicitly noting real Windows launch remains unverified.
