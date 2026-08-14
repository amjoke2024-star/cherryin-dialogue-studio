# 图片改字 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 CherryIN 对话画室中增加一个 Windows/macOS 通用的“图片改字”模式，用户通过本地 OCR 点击文字并只填写新文字，再复用现有 Image 2 编辑流程生成结果。

**Architecture:** OCR 在浏览器端运行，语言模型文件随应用离线提供；纯函数模块负责坐标换算、替换项校验和 Image 2 指令生成，页面只负责模式切换、画布交互与现有任务提交。后台继续使用现有 `/api/generate` 参考图编辑分支，不增加新的付费接口或自动重试。

**Tech Stack:** Next.js 16、React 19、TypeScript 5.9、Tesseract.js 7、Node test runner、现有 Apilio/CherryIN Image 2 API。

## Global Constraints

- OCR 必须在 Windows 和 macOS 浏览器使用同一套实现，不依赖 Python、PaddleOCR 或系统原生 OCR。
- 第一版只离线打包简体中文识别数据，覆盖常见中文、数字和英文字符。
- OCR 不调用 Image 2；未填写任何新文字时禁止提交。
- 任何失败均不得自动重新发起付费图片生成。
- 图片生成模式的现有行为必须保持不变。
- 尚未提交的 OCR 草稿不要求刷新恢复；已提交结果继续使用现有历史记录。
- 不加入字号、字重、字距、行距和自动多轮精细模式。

---

## File Structure

- `lib/text-edit.ts`：文字区域、替换项、比例坐标、校验和 Image 2 提示词纯函数。
- `lib/text-edit.test.ts`：上述纯函数的单元测试。
- `lib/browser-ocr.ts`：客户端 Tesseract worker 生命周期、离线资源路径和识别结果归一化。
- `app/components/TextEditWorkspace.tsx`：图片预览、文字框、列表、手动框选与替换输入。
- `app/text-edit.css`：图片改字模式专用布局和状态样式。
- `app/page.tsx`：模式切换、上传入口、OCR 调用、提交现有任务和继续修改状态。
- `public/ocr/`：构建时复制的 Tesseract worker/core/简体中文数据。
- `scripts/copy-ocr-assets.mjs`：将固定依赖版本的浏览器资源复制到 `public/ocr`。
- `package.json`：锁定 OCR 依赖并在开发/构建前准备离线资源。

---

### Task 1: 文字区域与 Image 2 指令纯函数

**Files:**
- Create: `lib/text-edit.ts`
- Create: `lib/text-edit.test.ts`

**Interfaces:**
- Produces: `TextRegion`, `TextReplacement`, `normalizeRegion()`, `hasPendingReplacement()`, `buildTextEditPrompt()`。
- `TextRegion` 坐标均为 0 到 1 的原图比例，避免页面缩放造成偏移。

- [ ] **Step 1: 写失败测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTextEditPrompt,
  hasPendingReplacement,
  normalizeRegion,
} from "./text-edit.ts";

test("normalizeRegion clamps and orders proportional coordinates", () => {
  assert.deepEqual(normalizeRegion({ x: 0.8, y: -0.2, width: -0.5, height: 1.4 }), {
    x: 0.3,
    y: 0,
    width: 0.5,
    height: 1,
  });
});

test("hasPendingReplacement requires a changed non-empty value", () => {
  assert.equal(hasPendingReplacement([{ id: "1", text: "299", replacement: "199", box: { x: 0, y: 0, width: 0.2, height: 0.1 }, source: "ocr" }]), true);
  assert.equal(hasPendingReplacement([{ id: "1", text: "299", replacement: "299", box: { x: 0, y: 0, width: 0.2, height: 0.1 }, source: "ocr" }]), false);
});

test("buildTextEditPrompt includes text and approximate location", () => {
  const prompt = buildTextEditPrompt([{ id: "1", text: "￥299", replacement: "￥199", box: { x: 0.7, y: 0.1, width: 0.2, height: 0.1 }, source: "ocr" }]);
  assert.match(prompt, /“￥299”替换为“￥199”/);
  assert.match(prompt, /右上区域/);
  assert.match(prompt, /其他内容保持不变/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test lib/text-edit.test.ts`

Expected: FAIL，提示无法找到 `./text-edit.ts`。

- [ ] **Step 3: 实现最小纯函数模块**

```ts
export type NormalizedBox = { x: number; y: number; width: number; height: number };
export type TextRegion = {
  id: string;
  text: string;
  replacement: string;
  box: NormalizedBox;
  source: "ocr" | "manual";
};

export function normalizeRegion(box: NormalizedBox): NormalizedBox;
export function hasPendingReplacement(regions: TextRegion[]): boolean;
export function buildTextEditPrompt(regions: TextRegion[]): string;
```

`buildTextEditPrompt()` 只包含实际发生变化的非空替换项，并将框中心转换为“左上、上方、右上、左侧、中央、右侧、左下、下方、右下区域”。末尾固定要求保持原字体观感、颜色、阴影、透视、纹理和所有未选区域不变。

- [ ] **Step 4: 运行单元测试**

Run: `npm test`

Expected: 所有测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add lib/text-edit.ts lib/text-edit.test.ts
git commit -m "feat: add image text replacement model"
```

---

### Task 2: 离线浏览器 OCR 服务

**Files:**
- Create: `lib/browser-ocr.ts`
- Create: `scripts/copy-ocr-assets.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create by script: `public/ocr/worker.min.js`
- Create by script: `public/ocr/tesseract-core-simd-lstm.wasm.js`
- Create by script: `public/ocr/tesseract-core-simd-lstm.wasm`
- Create by script: `public/ocr/chi_sim.traineddata.gz`

**Interfaces:**
- Consumes: `TextRegion` from `lib/text-edit.ts`。
- Produces: `recognizeImageText(image: File | string, onProgress?: (value: number) => void): Promise<TextRegion[]>` and `terminateOcr(): Promise<void>`。

- [ ] **Step 1: 安装固定依赖版本**

Run:

```bash
npm install tesseract.js@7.0.0 @tesseract.js-data/chi_sim@1.0.0
```

Expected: `package.json` 和锁文件出现精确主版本，安装成功。

- [ ] **Step 2: 编写离线资源复制脚本**

`scripts/copy-ocr-assets.mjs` 使用 `node:fs/promises` 的 `copyFile()`、`mkdir()` 与 `cp()`，从锁定依赖目录复制 worker、SIMD LSTM core 和 `chi_sim.traineddata.gz` 到 `public/ocr`。找不到任一源文件时抛出带具体路径的错误，不静默跳过。

在 `package.json` 增加：

```json
{
  "scripts": {
    "prepare:ocr": "node scripts/copy-ocr-assets.mjs",
    "predev": "npm run prepare:ocr",
    "prebuild": "npm run prepare:ocr"
  }
}
```

- [ ] **Step 3: 复制并验证资源存在**

Run:

```bash
npm run prepare:ocr
test -s public/ocr/worker.min.js
test -s public/ocr/tesseract-core-simd-lstm.wasm.js
test -s public/ocr/tesseract-core-simd-lstm.wasm
test -s public/ocr/chi_sim.traineddata.gz
```

Expected: 命令退出码为 0，四个文件均非空。

- [ ] **Step 4: 实现浏览器 OCR 包装器**

`lib/browser-ocr.ts` 必须以 `"use client"` 开头，懒加载并复用单个 worker：

```ts
export async function recognizeImageText(
  image: File | string,
  onProgress?: (value: number) => void,
): Promise<TextRegion[]>;

export async function terminateOcr(): Promise<void>;
```

创建 worker 时显式使用 `/ocr/worker.min.js`、`/ocr/tesseract-core-simd-lstm.wasm.js` 和 `/ocr` 语言目录。只保留有非空文字且宽高大于零的 word/line 结果，将像素框除以 OCR 返回图像宽高转换成比例坐标；识别进度限制在 0 到 1。

- [ ] **Step 5: 类型检查与生产构建**

Run: `npm run typecheck && npm run build`

Expected: PASS；构建过程中 `prepare:ocr` 成功执行，Next.js 不在服务端求值 Web Worker。

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json scripts/copy-ocr-assets.mjs lib/browser-ocr.ts public/ocr
git commit -m "feat: bundle offline browser OCR"
```

---

### Task 3: 图片文字框与手动框选工作区

**Files:**
- Create: `app/components/TextEditWorkspace.tsx`
- Create: `app/text-edit.css`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `TextRegion` from `lib/text-edit.ts`。
- Produces component:

```ts
type TextEditWorkspaceProps = {
  image: { name: string; data: string };
  regions: TextRegion[];
  activeId: string | null;
  recognizing: boolean;
  progress: number;
  onActiveChange(id: string | null): void;
  onRegionsChange(regions: TextRegion[]): void;
};
```

- [ ] **Step 1: 创建受控工作区组件**

组件包含图片层、绝对定位文字框层、识别进度和替换列表。文字框使用百分比样式：

```tsx
style={{
  left: `${region.box.x * 100}%`,
  top: `${region.box.y * 100}%`,
  width: `${region.box.width * 100}%`,
  height: `${region.box.height * 100}%`,
}}
```

点击框时调用 `onActiveChange(region.id)` 并将相应列表项滚入可见区域；修改原文字或新文字时返回新的不可变数组。

- [ ] **Step 2: 添加手动拖框**

在图片容器的 Pointer Down/Move/Up 中记录相对于容器的比例坐标，拖动超过图片宽高的 1% 后新增：

```ts
{
  id: crypto.randomUUID(),
  text: "",
  replacement: "",
  box: normalizeRegion(draftBox),
  source: "manual",
}
```

手动框新增后立即选中，并聚焦“原文字”输入框；Escape 取消尚未完成的拖框。

- [ ] **Step 3: 添加响应式样式**

桌面宽度大于等于 900px 时图片和列表左右排列；窄屏上下排列。激活框使用高对比色，未激活框保持可见但不遮挡原图；识别中禁用手动框选和输入。

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add app/components/TextEditWorkspace.tsx app/text-edit.css app/globals.css
git commit -m "feat: add image text selection workspace"
```

---

### Task 4: 接入现有对话输入与 Image 2 任务

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/api/jobs/store.ts`
- Modify: `lib/job-lifecycle.ts`
- Modify: `lib/job-lifecycle.test.ts`

**Interfaces:**
- Consumes: `recognizeImageText()`, `terminateOcr()`, `buildTextEditPrompt()`, `hasPendingReplacement()`, `TextEditWorkspace`。
- Produces: `StudioMode = "generate" | "text-edit"`；图片改字任务元数据 `textEdit?: { sourceImage: Reference; regions: TextRegion[] }`。

- [ ] **Step 1: 为任务元数据写失败测试**

在 `lib/job-lifecycle.test.ts` 增加一条图片改字任务序列化/恢复测试，断言 `mode: "text-edit"`、原图和 replacement 字段不会在任务状态转换时丢失。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，任务类型尚不接受 `mode` 或 `textEdit`。

- [ ] **Step 3: 扩展任务类型但保持旧记录兼容**

为任务结构增加可选字段；读取旧任务时缺少 `mode` 必须按 `"generate"` 处理。不要改变旧任务的 API 请求体。

- [ ] **Step 4: 在输入区增加模式切换**

将现有“图片生成”按钮改成两个互斥按钮：“图片生成”和“图片改字”。模式切换分别保留现有 prompt/attachments 与 text-edit 原图/regions 草稿；图片改字模式只允许一张原图。

- [ ] **Step 5: 接入 OCR 生命周期**

图片改字模式选择图片后立即调用 `recognizeImageText()`，展示真实识别进度；成功后设置 regions，零结果提示“没有识别到文字，请在图片上手动框选”。组件卸载或页面离开时调用 `terminateOcr()`。

- [ ] **Step 6: 复用现有任务提交**

提交按钮仅在 `hasPendingReplacement(regions)` 为真且 OCR 未运行时启用。请求使用：

```ts
{
  ...existingRequest,
  prompt: buildTextEditPrompt(regions),
  references: [sourceImage],
  archiveReferences: true,
}
```

模型仍使用当前来源对应的 GPT Image 2；如果当前选中模型不是 GPT Image 2，界面提示并切换为该来源的默认 Image 2。不要添加任何自动重试。

- [ ] **Step 7: 结果与继续修改**

图片改字结果进入现有对话历史。点击“继续修改”时使用最新结果作为新的 sourceImage，并恢复上一轮 regions 和 replacement；用户可以继续编辑 replacement 后再次主动提交。

- [ ] **Step 8: 运行测试、类型检查和构建**

Run: `npm test && npm run typecheck && npm run build`

Expected: 全部 PASS；现有 generation scheduler 与 job lifecycle 测试无回归。

- [ ] **Step 9: 提交**

```bash
git add app/page.tsx app/api/jobs/store.ts lib/job-lifecycle.ts lib/job-lifecycle.test.ts
git commit -m "feat: integrate image text edit mode"
```

---

### Task 5: 本地浏览器验证与设计 QA

**Files:**
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: 完整图片改字 MVP。
- Produces: 可复查的本地验证记录；不产生付费图片请求。

- [ ] **Step 1: 启动当前应用并确认目标**

Run: `npm run dev`

Expected: `http://localhost:3000` 返回页面，标题为 CherryIN 对话画室；若使用现有 3100 服务，先验证实际服务资产属于 `/Users/xieyingjun/Documents/画室`，不要盲目重启占用端口的其他服务。

- [ ] **Step 2: 验证图片生成模式无回归**

在浏览器中确认原模式仍可上传多张参考图、选择模型/尺寸/数量、查看历史和打开结果；不要点击最终生成按钮。

- [ ] **Step 3: 验证 OCR 与修改草稿**

使用一张含中文与数字的本地测试图片，确认离线识别有进度、文字框与列表联动、原文字可修正、新文字可填写、手动拖框可新增。断开网络后重新加载 OCR 资源，确认资源仍来自 `/ocr/` 本地路径。

- [ ] **Step 4: 验证提交保护**

确认无替换内容时按钮禁用；识别中按钮禁用；构造请求前检查只包含一张原图与生成后的结构化提示词。拦截 `/api/jobs` 或使用无效测试 Key 验证错误展示，不执行付费实时生成。

- [ ] **Step 5: 响应式与可见内容 QA**

检查桌面宽屏和窄屏：文字框对齐图片、列表不溢出、模式按钮可辨识、错误和进度不遮挡操作。把验证日期、页面尺寸、通过项和已知限制写入 `design-qa.md`。

- [ ] **Step 6: 最终验证**

Run: `npm test && npm run typecheck && npm run build && git diff --check`

Expected: 全部退出码为 0。

- [ ] **Step 7: 提交**

```bash
git add design-qa.md
git commit -m "docs: verify image text edit MVP"
```
