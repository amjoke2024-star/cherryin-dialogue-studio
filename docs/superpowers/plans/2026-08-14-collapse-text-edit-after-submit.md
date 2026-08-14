# 图片改字提交后收起 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新图片改字任务提交后自动收起大型 OCR 工作区，让生成任务进度保持可见，同时允许用户重新展开草稿。

**Architecture:** 页面增加受控的 `textEditWorkspaceExpanded` 状态；上传、继续改字时展开，新图片改字任务通过校验并进入任务流程后收起。历史任务的“再次生成”不改变当前编辑器状态。现有任务滚动效果继续负责把当前任务带入视野，不改动 Image 2 请求和结果处理。

**Tech Stack:** Next.js 16、React 19、TypeScript 5.9、Node test runner。

## Global Constraints

- 只改变编辑区展示状态，不清空图片、OCR 区域或已填写的新文字。
- 只在提交新的图片改字任务时自动收起；历史任务再次生成不得影响当前草稿。
- 收起后保留图片缩略图、图片改字模式、模型参数和“展开编辑内容”入口。
- 不改动 Image 2 请求、提示词、生成结果和任务队列逻辑。

---

### Task 1: 提交后收起 OCR 工作区

**Files:**
- Modify: `lib/text-edit.ts`
- Modify: `lib/text-edit.test.ts`
- Modify: `app/page.tsx`
- Modify: `app/text-edit.css`

**Interfaces:**
- Produces: `shouldCollapseTextEditWorkspace(isTextEdit: boolean, isRepeat: boolean): boolean`。
- Adds page state: `textEditWorkspaceExpanded: boolean`。

- [ ] **Step 1: 写失败测试**

```ts
test("only a new text edit submission collapses the workspace", () => {
  assert.equal(shouldCollapseTextEditWorkspace(true, false), true);
  assert.equal(shouldCollapseTextEditWorkspace(true, true), false);
  assert.equal(shouldCollapseTextEditWorkspace(false, false), false);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test lib/text-edit.test.ts`

Expected: FAIL，提示没有导出 `shouldCollapseTextEditWorkspace`。

- [ ] **Step 3: 实现收起判断和页面状态**

`shouldCollapseTextEditWorkspace()` 仅返回 `isTextEdit && !isRepeat`。页面初始展开；上传图片、继续修改时设置为展开；新图片改字任务建立后设置为收起。

- [ ] **Step 4: 添加收起摘要**

仅当 `textEditImage && textEditWorkspaceExpanded` 时渲染 `TextEditWorkspace`。收起状态在现有图片改字简介中显示“任务已提交，编辑内容已收起”，并提供“展开编辑内容”按钮；点击后恢复工作区，不重新 OCR。

- [ ] **Step 5: 完整验证**

Run: `npm test && npm run typecheck && npm run build`

Expected: 所有测试、类型检查和生产构建通过；浏览器中提交任务后工作区消失，任务进度可见，展开后原输入仍保留。

- [ ] **Step 6: 提交**

```bash
git add docs/superpowers/specs/2026-08-14-image-text-edit-mvp-design.md docs/superpowers/plans/2026-08-14-collapse-text-edit-after-submit.md lib/text-edit.ts lib/text-edit.test.ts app/page.tsx app/text-edit.css
git commit -m "feat: collapse text edit workspace after submit"
```
