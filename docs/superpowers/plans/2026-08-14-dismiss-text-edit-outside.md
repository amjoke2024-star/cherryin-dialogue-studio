# 图片改字点击外部收起 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 展开的图片改字工作区支持点击外部或按 Esc 收起，并完整保留草稿。

**Architecture:** 页面为当前 composer 根节点增加 ref；工作区展开且已有图片时注册 document 级 `pointerdown` 和 `keydown` 监听。指针目标不在 composer 内或按下 Escape 时，仅设置 `textEditWorkspaceExpanded(false)`；关闭、重新展开和组件内部交互均不修改图片与识别状态。

**Tech Stack:** React 19、TypeScript 5.9、Node test runner。

## Global Constraints

- 点击 composer 内部不得收起。
- 点击 composer 外部或按 Esc 必须收起。
- 收起不得清空原图、OCR 区域、当前选区和替换文字。
- 监听器仅在图片改字工作区展开时存在，并在状态变化或卸载时移除。

### Task 1: 外部点击收起

**Files:**
- Modify: `lib/text-edit.ts`
- Modify: `lib/text-edit.test.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1:** 为 `shouldDismissTextEditWorkspace(expanded, hasImage, pointerInside)` 写失败测试。
- [ ] **Step 2:** 实现判断函数并让测试通过。
- [ ] **Step 3:** 为 composer 增加 ref 和按条件注册的 `pointerdown`、`keydown` 监听器。
- [ ] **Step 4:** 运行 `npm test && npm run typecheck && npm run build`，并在浏览器中验证内点不收起、外点收起、重新展开保留内容。
- [ ] **Step 5:** 提交 `git commit -m "feat: dismiss text edit workspace outside"`。
