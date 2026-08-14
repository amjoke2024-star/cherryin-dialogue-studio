# 图片改字返回与只读原文字 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为图片改字工作区增加明确的返回入口，并将 OCR 原文字改为只读、可复制的内容。

**Architecture:** `TextEditWorkspace` 继续作为受控组件，通过新增的 `onBack` 回调通知页面清空当前图片改字草稿。原文字使用只读控件展示，复制动作通过一个独立纯函数封装，以便测试成功与失败分支；新文字输入和现有 Image 2 提交流程保持不变。

**Tech Stack:** Next.js 16、React 19、TypeScript 5.9、Node test runner、Clipboard API。

## Global Constraints

- “返回重新选图”必须清空当前图片、OCR 区域、当前选中区域和识别进度，并回到上传步骤。
- OCR 原文字不能被用户修改，但必须可以选中并通过按钮复制。
- 手动框选区域的原文字允许为空；用户仍只填写“改成”的内容。
- 每条记录右上角的删除按钮继续只删除该文字区域。
- 不改动现有 Image 2 提交、任务历史或付费请求逻辑。

---

### Task 1: 返回动作与只读复制交互

**Files:**
- Create: `lib/clipboard.ts`
- Create: `lib/clipboard.test.ts`
- Modify: `app/components/TextEditWorkspace.tsx`
- Modify: `app/page.tsx`
- Modify: `app/text-edit.css`

**Interfaces:**
- Produces: `copyText(text: string, clipboard?: Pick<Clipboard, "writeText">): Promise<boolean>`。
- Extends: `TextEditWorkspaceProps` with `onBack(): void`。
- Consumes: 页面现有的 `setTextEditImage`、`setTextRegions`、`setActiveTextRegion`、`setRecognizingText` 和 `setOcrProgress` 状态更新函数。

- [ ] **Step 1: 写复制功能的失败测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { copyText } from "./clipboard.ts";

test("copyText copies non-empty OCR text", async () => {
  let copied = "";
  assert.equal(await copyText("原文字", { writeText: async (value) => { copied = value; } }), true);
  assert.equal(copied, "原文字");
});

test("copyText rejects empty text and clipboard failures", async () => {
  assert.equal(await copyText("", { writeText: async () => undefined }), false);
  assert.equal(await copyText("原文字", { writeText: async () => { throw new Error("denied"); } }), false);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test lib/clipboard.test.ts`

Expected: FAIL，提示无法找到 `./clipboard.ts`。

- [ ] **Step 3: 实现最小复制函数**

```ts
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = navigator.clipboard,
): Promise<boolean> {
  if (!text || !clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: 修改工作区交互**

在 `TextEditWorkspaceProps` 增加 `onBack(): void`。工作区顶部增加“← 返回重新选图”按钮并调用 `onBack`。原文字控件设置 `readOnly`，移除修改 `region.text` 的 `onChange`，旁边增加“复制”按钮；复制成功后按钮短暂显示“已复制”，失败则显示“复制失败”。手动框选完成后聚焦对应的“改成”输入框。

- [ ] **Step 5: 接入页面清理动作**

在 `app/page.tsx` 创建并传入 `resetTextEditDraft()`：

```ts
const resetTextEditDraft = () => {
  setTextEditImage(null);
  setTextRegions([]);
  setActiveTextRegion(null);
  setRecognizingText(false);
  setOcrProgress(0);
  if (fileInput.current) fileInput.current.value = "";
};
```

按钮返回后保留 `studioMode === "text-edit"`，因此页面显示原有上传提示。

- [ ] **Step 6: 添加样式并验证**

在 `app/text-edit.css` 增加返回按钮、只读原文字和复制反馈样式；窄屏下按钮保持可见且不造成横向滚动。

Run: `npm test && npm run typecheck && npm run build`

Expected: 所有测试 PASS，类型检查和生产构建退出码为 0。

- [ ] **Step 7: 提交**

```bash
git add docs/superpowers/specs/2026-08-14-image-text-edit-mvp-design.md docs/superpowers/plans/2026-08-14-text-edit-return-readonly-original.md lib/clipboard.ts lib/clipboard.test.ts app/components/TextEditWorkspace.tsx app/page.tsx app/text-edit.css
git commit -m "feat: refine image text edit controls"
```
