# Windows x64 V4 Portable Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `CherryIN-Studio-Windows-x64-V4.zip` from the current formal `main` build with offline OCR and one-click startup.

**Architecture:** Build a fresh Next.js standalone application from the formal source, stage it in an isolated release directory, and add the previously validated Windows x64 Node runtime plus Windows native dependencies. Copy all current public OCR assets, reset user data, create a diagnostic launcher, then validate platform binaries, privacy exclusions, archive integrity, and checksum.

**Tech Stack:** Next.js 16 standalone output, Node.js Windows x64 runtime, Windows x64 Sharp/libvips, ZIP, SHA-256.

## Global Constraints

- Output filename is exactly `CherryIN-Studio-Windows-x64-V4.zip`.
- Support Windows 10/11 x64 with `Start-Studio.bat` as the primary launcher.
- Include the current image text editing feature and all offline OCR browser assets.
- Exclude API keys, existing history, generated images, logs, PID files, macOS launchers, Mach-O files, `.dylib`, and Darwin native packages.
- Package an empty writable `data/history.json` and empty `public/generated` directory.
- Do not run a paid image generation.
- Report Windows static validation separately from real Windows launch validation.

---

### Task 1: Fresh formal build

**Files:**
- Consume: `package.json`, `next.config.ts`, `app/`, `lib/`, `public/`
- Create: temporary `CherryIN-Studio-Windows-x64/`

- [ ] Run `npm test`, `npm run typecheck`, and `npm run build` from formal `main`.
- [ ] Copy `.next/standalone`, `.next/static`, and current `public` into an isolated staging directory.
- [ ] Verify the staged bundle contains `图片改字` code and `public/ocr/chi_sim.traineddata.gz`.

### Task 2: Windows runtime and clean user data

**Files:**
- Create: `runtime/node.exe`
- Create: `data/history.json`
- Create: `public/generated/`

- [ ] Reuse the validated V3 Windows x64 runtime and Windows native dependency directories.
- [ ] Remove incompatible Darwin/Linux native packages before copying Windows packages.
- [ ] Reset history to `[]` and remove every generated image.
- [ ] Confirm `node.exe`, Sharp, and libvips identify as PE32+ x86-64.

### Task 3: Launcher and release files

**Files:**
- Create: `Start-Studio.bat`
- Create: `Start-Studio.ps1`
- Create: `使用说明.txt`
- Create: `CherryIN-Studio-Windows-x64-V4.zip`
- Create: `CherryIN-Studio-Windows-x64-V4.sha256.txt`

- [ ] Create a visible launcher that starts port 3100, opens the browser, and keeps diagnostic errors visible.
- [ ] Save batch and text instructions using Windows-compatible CRLF line endings.
- [ ] Scan for secrets, user history, generated images, Mac binaries, `.DS_Store`, and logs.
- [ ] Create and test the ZIP and generate its SHA-256 checksum.
- [ ] Report archive size and static validation results, with Windows real-machine startup marked pending.
