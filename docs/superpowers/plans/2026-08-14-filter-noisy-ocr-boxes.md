# OCR 误识别框过滤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 默认隐藏明显的 OCR 误识别框，同时允许用户随时查看全部结果。

**Architecture:** `TextRegion` 保存 OCR confidence；纯函数按置信度、有效字符、符号占比和异常框范围判断默认可见性。工作区只过滤渲染数组，不删除原始 regions；手动框和已填写替换文字的区域强制显示，并提供“显示全部/隐藏低可信框”切换。

**Tech Stack:** TypeScript、React 19、Tesseract.js、Node test runner。

## Global Constraints

- 过滤只影响界面显示，不删除 OCR 数据。
- 手动框选区域和已有 replacement 的区域始终显示。
- confidence 低于 45 的 OCR 区域默认隐藏。
- 无中英文或数字有效字符、符号占比过高、面积超过图片 14% 的区域默认隐藏。
- 切换显示全部时编号按当前可见顺序连续显示。

### Task 1: OCR 质量数据和过滤规则

**Files:**
- Modify: `lib/text-edit.ts`
- Modify: `lib/text-edit.test.ts`
- Modify: `lib/browser-ocr.ts`
- Modify: `lib/browser-ocr.test.ts`

- [ ] **Step 1:** 写失败测试覆盖可信文字、低置信度、纯符号、超大区域、手动框和已编辑区域。
- [ ] **Step 2:** 为 `TextRegion` 增加 `confidence?: number`，OCR 转换时保存原始 confidence。
- [ ] **Step 3:** 实现 `isLikelyTextRegion(region)` 并运行单元测试。

### Task 2: 显示全部切换

**Files:**
- Modify: `app/components/TextEditWorkspace.tsx`
- Modify: `app/text-edit.css`

- [ ] **Step 1:** 组件维护 `showAllRegions`，默认只渲染 `isLikelyTextRegion` 通过的区域。
- [ ] **Step 2:** 标题显示“已显示 N 处 · 隐藏 M 处”，并增加“显示全部/隐藏低可信框”按钮。
- [ ] **Step 3:** 列表、画布和空状态使用同一 visibleRegions，切换不修改 props.regions。
- [ ] **Step 4:** 运行 `npm test && npm run typecheck && npm run build`，浏览器验证切换和响应式布局。
- [ ] **Step 5:** 提交 `git commit -m "feat: filter noisy OCR regions"`。
