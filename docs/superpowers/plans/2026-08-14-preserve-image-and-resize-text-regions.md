# Preserve Image And Resize Text Regions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep uploaded reference images when switching into image text editing and let users resize recognized text regions from their four corners.

**Architecture:** Add small pure helpers for choosing an existing attachment as the text-edit source and resizing normalized boxes. Keep OCR orchestration in `app/page.tsx`; keep pointer interaction and visual handles inside `TextEditWorkspace`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node test runner, CSS.

## Global Constraints

- Switching modes must never clear the generate-mode attachment list.
- Only the first generate attachment becomes the initial text-edit source when no text-edit image exists.
- Existing text-edit state must not be overwritten or re-recognized on later mode switches.
- Resizing is limited to four corner handles and stays inside the image with a minimum normalized width and height of `0.01`.
- The original OCR text remains read-only.

---

### Task 1: Pure image selection and box resizing rules

**Files:**
- Modify: `lib/text-edit.ts`
- Test: `lib/text-edit.test.ts`

**Interfaces:**
- Produces: `preferredTextEditSource(current, attachments)` and `resizeTextRegionBox(box, corner, point)`.

- [ ] **Step 1: Write failing tests** for first-attachment selection, preserving an existing source, all four corners, image-bound clamping, and minimum size.
- [ ] **Step 2: Run `npm test -- lib/text-edit.test.ts`** and verify failures are caused by the missing exports.
- [ ] **Step 3: Implement the minimal pure helpers** using normalized coordinates and `normalizeRegion`.
- [ ] **Step 4: Run `npm test -- lib/text-edit.test.ts`** and verify the new tests pass.

### Task 2: Preserve uploaded image across mode switches

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `preferredTextEditSource(current, attachments)`.
- Produces: shared OCR starter accepting `{ name: string; data: string }`.

- [ ] **Step 1: Extract OCR startup** from the file-only path into a function accepting an already-read image.
- [ ] **Step 2: On switching to text edit**, select the existing text-edit image or first generate attachment; only run OCR for a newly adopted attachment.
- [ ] **Step 3: Keep the attachment array untouched** so returning to image generation restores every uploaded image.
- [ ] **Step 4: Run type checking and tests** to catch stale async state or type regressions.

### Task 3: Four-corner resizing UI

**Files:**
- Modify: `app/components/TextEditWorkspace.tsx`
- Modify: `app/text-edit.css`

**Interfaces:**
- Consumes: `resizeTextRegionBox(box, corner, point)`.
- Produces: four pointer handles on the active region and live `onRegionsChange` updates.

- [ ] **Step 1: Add transient resize state** storing region id, corner, and original box.
- [ ] **Step 2: Render four labeled handles** only on the active box and prevent handle gestures from starting a new manual box.
- [ ] **Step 3: Update the region live on pointer movement** and release pointer capture on completion/cancel.
- [ ] **Step 4: Add restrained handle styling and update the help copy** to explain corner resizing.

### Task 4: Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run `npm test`, `npm run typecheck`, and `npm run build`.**
- [ ] **Step 2: Open the local app**, upload in image generation, switch modes twice, and confirm images persist.
- [ ] **Step 3: Select an OCR box and drag a corner**, confirming its size changes and no new manual box is created.
- [ ] **Step 4: Check browser console and responsive layout** for visible errors or overflow.
