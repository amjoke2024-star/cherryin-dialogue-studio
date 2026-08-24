# Product Blending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a “产品溶图” mode that lets the user mark one product with a movable rectangular selection, choose realistic lighting or visual priority, add optional instructions, and submit one recoverable image-edit job.

**Architecture:** Reuse the existing normalized-box primitives and image-edit job path, while keeping product-blending prompt construction, guide rendering, and UI state in focused modules. The page orchestrates the new mode and persists its draft in turns/jobs; the API contract remains unchanged because the original and transient guide are ordinary references.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Canvas 2D, Node test runner, existing `/api/generate` job API.

**Spec:** `docs/superpowers/specs/2026-08-24-product-blending-design.md`

## Global Constraints

- Add “产品溶图” after “图片改字” in the existing composer; do not create a separate application.
- First release supports exactly one rectangular product selection with move and four-corner resize.
- Styles are exactly `realistic-lighting` and `visual-priority`; additional instructions are optional.
- Generate exactly one output, preserve the source aspect ratio, and use an image-edit-capable GPT Image 2 route.
- Persist the clean source image, box, style, and additional instructions; never persist the generated guide image.
- Never automatically retry or recreate a paid job; polling reads the existing `queueId` only.
- Automated acceptance must not use the user's API key or submit a real paid generation.

---

## File Structure

- Create `lib/product-blend.ts`: product-blend types, validation, prompt construction, persistence filtering, and workspace-collapse rules.
- Create `lib/product-blend.test.ts`: unit tests for validation, prompts, and transient guide filtering.
- Create `lib/product-blend-guide.ts`: browser Canvas guide-image creation.
- Create `app/components/ProductBlendWorkspace.tsx`: region selection and style-selection UI.
- Create `app/product-blend.css`: product-blend workspace styling and responsive layout.
- Modify `lib/job-lifecycle.ts` and `lib/job-lifecycle.test.ts`: recognize `product-blend` as a persisted studio mode.
- Modify `app/page.tsx`: mode state, upload handling, rendering, submission, history, recovery, and composer controls.
- Modify `app/api/generate/route.ts`: generalize persistent-reference filtering for all transient guide references.

---

### Task 1: Product-Blend Domain Rules

**Files:**
- Create: `lib/product-blend.ts`
- Create: `lib/product-blend.test.ts`
- Modify: `lib/job-lifecycle.ts`
- Modify: `lib/job-lifecycle.test.ts`

**Interfaces:**
- Produces: `ProductBlendStyle`, `ProductBlendState`, `isValidProductBox(box)`, `buildProductBlendPrompt(style, additionalPrompt, options)`, `persistentProductBlendReferences(references)`, and `shouldCollapseProductBlendWorkspace(isProductBlend, isRepeat)`.
- Consumes: `NormalizedBox` from `lib/text-edit.ts` and the existing `StudioMode` persistence contract.

- [ ] **Step 1: Write failing tests for mode normalization, selection validity, prompt constraints, and transient filtering**

```ts
test("product blend is a persisted studio mode", () => {
  assert.equal(normalizeStudioMode("product-blend"), "product-blend");
});

test("product selection needs at least one percent on both axes", () => {
  assert.equal(isValidProductBox({ x: 0.1, y: 0.1, width: 0.01, height: 0.4 }), true);
  assert.equal(isValidProductBox({ x: 0.1, y: 0.1, width: 0.009, height: 0.4 }), false);
});

test("realistic lighting prompt preserves product identity", () => {
  const prompt = buildProductBlendPrompt("realistic-lighting", "加强左侧暖光", { hasGuide: true });
  assert.match(prompt, /严格保持产品轮廓、比例、结构、颜色、Logo、包装文字与图案/);
  assert.match(prompt, /定位图.*不得出现在结果中/);
  assert.match(prompt, /加强左侧暖光/);
});

test("visual priority prompt permits controlled advertising polish", () => {
  const prompt = buildProductBlendPrompt("visual-priority", "", { hasGuide: true });
  assert.match(prompt, /允许加强轮廓光、高光、反射、材质表现/);
  assert.match(prompt, /不增加、删除、替换或复制产品/);
});

test("guide references are not persisted", () => {
  assert.deepEqual(persistentProductBlendReferences([
    { name: "原图.png", transient: false },
    { name: "产品定位图.png", transient: true },
  ]), [{ name: "原图.png", transient: false }]);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- --test-name-pattern='product blend|product selection|realistic lighting|visual priority|guide references'`

Expected: FAIL because the product-blend exports and mode do not exist.

- [ ] **Step 3: Implement the domain module and mode normalization**

```ts
export type ProductBlendStyle = "realistic-lighting" | "visual-priority";
export type ProductBlendState = {
  sourceImage: { name: string; data: string };
  productBox: NormalizedBox;
  blendStyle: ProductBlendStyle;
  additionalPrompt: string;
};

export function isValidProductBox(box: NormalizedBox | null): box is NormalizedBox {
  return Boolean(box && box.width >= 0.01 && box.height >= 0.01);
}

export function persistentProductBlendReferences<T extends { transient?: boolean }>(references: T[]) {
  return references.filter((reference) => !reference.transient);
}
```

Build `buildProductBlendPrompt` from immutable common constraints followed by the selected style block and, when non-empty, a final `用户补充要求：...` line. Update `StudioMode` to `"generate" | "text-edit" | "product-blend"` and make `normalizeStudioMode` preserve both edit modes.

- [ ] **Step 4: Run the focused tests and the complete unit suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit the domain rules**

```bash
git add lib/product-blend.ts lib/product-blend.test.ts lib/job-lifecycle.ts lib/job-lifecycle.test.ts
git commit -m "feat: add product blending domain rules"
```

---

### Task 2: Product Guide Image

**Files:**
- Create: `lib/product-blend-guide.ts`
- Modify: `lib/product-blend.test.ts`

**Interfaces:**
- Consumes: `NormalizedBox` and `isValidProductBox`.
- Produces: `productBlendGuideGeometry(box, width, height)` and async `createProductBlendGuideImage(imageData, box): Promise<string>`.

- [ ] **Step 1: Add failing geometry tests**

```ts
test("guide geometry converts normalized selection to pixels", () => {
  assert.deepEqual(
    productBlendGuideGeometry({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 }, 1000, 500),
    { x: 100, y: 100, width: 500, height: 200 },
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --test-name-pattern='guide geometry'`

Expected: FAIL because `productBlendGuideGeometry` is missing.

- [ ] **Step 3: Implement geometry and Canvas rendering**

```ts
export function productBlendGuideGeometry(box: NormalizedBox, width: number, height: number) {
  return {
    x: Math.round(box.x * width),
    y: Math.round(box.y * height),
    width: Math.round(box.width * width),
    height: Math.round(box.height * height),
  };
}
```

`createProductBlendGuideImage` must load the source into an `Image`, draw it at native dimensions, dim everything outside the selected rectangle with four translucent fills, draw a high-contrast cyan rectangle labeled “产品区域”, and return `canvas.toDataURL("image/png")`. Reject invalid image data and invalid boxes before rendering.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the guide generator**

```bash
git add lib/product-blend-guide.ts lib/product-blend.test.ts
git commit -m "feat: create product blend guide image"
```

---

### Task 3: Product-Blend Workspace

**Files:**
- Create: `app/components/ProductBlendWorkspace.tsx`
- Create: `app/product-blend.css`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `NormalizedBox`, `normalizeRegion`, `resizeTextRegionBox`, `ProductBlendStyle`, and `isValidProductBox`.
- Produces: controlled UI callbacks `onBoxChange`, `onStyleChange`, `onAdditionalPromptChange`, `onBack`, and `onSubmit`.

- [ ] **Step 1: Add the controlled component shell with accessible labels**

Create props exactly as follows:

```ts
type ProductBlendWorkspaceProps = {
  image: { name: string; data: string };
  box: NormalizedBox | null;
  step: "select-region" | "choose-style";
  style: ProductBlendStyle | null;
  additionalPrompt: string;
  busy: boolean;
  onBoxChange(box: NormalizedBox | null): void;
  onStepChange(step: "select-region" | "choose-style"): void;
  onStyleChange(style: ProductBlendStyle): void;
  onAdditionalPromptChange(value: string): void;
  onBack(): void;
  onSubmit(): void;
};
```

Render a section with `aria-label="产品溶图工作区"`, a `button` named “下一步”, radio-like buttons named “真实校光” and “视觉优先”, a textbox labelled “补充要求（可选）”, and a submit button named “开始溶图”.

- [ ] **Step 2: Implement rectangle draw, move, resize, and validation**

Use pointer capture. Blank-canvas drag calls `normalizeRegion` and replaces the previous box. Dragging the selection offsets the original box while clamping it inside `[0, 1]`. Four handles call `resizeTextRegionBox`. Disable “下一步” unless `isValidProductBox(box)`.

- [ ] **Step 3: Add responsive styling**

Use a two-column desktop layout with the image canvas on the left and controls on the right; below 850px stack them vertically. Reuse the existing dark panel, cyan active color, border radius, and button typography variables rather than introducing a new visual language.

- [ ] **Step 4: Mount the workspace in the page without submission logic**

Import `./product-blend.css`, add controlled draft state, render `ProductBlendWorkspace` when `studioMode === "product-blend"`, and preserve the draft while switching modes. Upload in product-blend mode accepts one image and sets it as the source without OCR.

- [ ] **Step 5: Run typecheck and build**

Run: `npm run typecheck && npm run build`

Expected: both PASS; no API request is made.

- [ ] **Step 6: Commit the workspace**

```bash
git add app/components/ProductBlendWorkspace.tsx app/product-blend.css app/page.tsx
git commit -m "feat: add product blending workspace"
```

---

### Task 4: Submission, Persistence, and Recovery

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/api/generate/route.ts`
- Modify: `lib/product-blend.ts`
- Modify: `lib/product-blend.test.ts`

**Interfaces:**
- Consumes: `createProductBlendGuideImage`, `buildProductBlendPrompt`, `isValidProductBox`, and the existing `GenerationJob`/`Turn` pipeline.
- Produces: product-blend turns and jobs that survive refresh and repeat without persisting the guide image.

- [ ] **Step 1: Add failing tests for task preparation and persistent references**

Extract a pure helper with this signature:

```ts
prepareProductBlendInput(
  state: ProductBlendState,
  guideData: string,
): { prompt: string; references: Array<{ name: string; data: string; transient?: boolean }> };
```

Assert that the first reference is the clean source, the second is named `产品定位图.png` with `transient: true`, and the prompt contains the selected style plus user text.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --test-name-pattern='product blend input|guide references'`

Expected: FAIL because `prepareProductBlendInput` is missing.

- [ ] **Step 3: Implement submission in `send()`**

Detect product blend from either the current mode or repeated turn. Validate source, selection, and style before creating a guide. Build the prompt and two references, select GPT Image 2 when the active model is not compatible, compute output size from the source aspect ratio, force `count = 1`, set `mode: "product-blend"`, and store the product-blend state on both `Turn` and `GenerationJob`.

- [ ] **Step 4: Generalize API reference persistence**

Rename the API-local archive helper to `archivePersistentReferences` and filter every `{ transient: true }` reference, rather than applying text-edit-specific naming. Preserve request order for the references sent upstream; only archival filtering changes.

- [ ] **Step 5: Restore and repeat product-blend jobs**

Update parsing and history rendering so old jobs without a mode remain `generate`, product-blend jobs restore their source/box/style/additional prompt, repeated jobs rebuild a fresh transient guide, and refresh polling uses the stored `queueId` without creating a new paid job.

- [ ] **Step 6: Run full verification**

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests PASS and production build completes.

- [ ] **Step 7: Commit submission and recovery**

```bash
git add app/page.tsx app/api/generate/route.ts lib/product-blend.ts lib/product-blend.test.ts
git commit -m "feat: submit and recover product blending jobs"
```

---

### Task 5: Live UI Verification and Service Update

**Files:**
- Modify only if verification reveals a defect in files from Tasks 1-4.

**Interfaces:**
- Consumes: completed product-blend UI and job pipeline.
- Produces: verified local production service at `http://localhost:3100` without a paid generation.

- [ ] **Step 1: Run the final static verification chain**

Run: `npm test && npm run typecheck && npm run build && git diff --check`

Expected: all commands PASS.

- [ ] **Step 2: Restart the existing local production service**

Restart `com.cherryin.dialogue-studio` through its existing LaunchAgent, then wait for port 3100 to listen and return HTTP 200. Do not start a competing server on the same port.

- [ ] **Step 3: Verify the UI in the browser**

Confirm “产品溶图” appears after “图片改字”; upload a local non-sensitive fixture; draw, move, and resize one rectangle; continue to style selection; choose both style buttons in turn; enter a supplemental requirement; verify “开始溶图” becomes enabled. Stop before submitting because submission is a paid external action.

- [ ] **Step 4: Verify narrow layout**

At a viewport width below 850px, confirm the canvas and controls stack, all buttons remain reachable, and the selection can still be manipulated.

- [ ] **Step 5: Record the verification boundary and commit any fixes**

If fixes were needed, rerun Step 1 and commit them with:

```bash
git add app lib
git commit -m "fix: polish product blending workflow"
```

Report explicitly that code, simulated task construction, production build, and local UI were verified, while a real paid model result remains for user acceptance.
