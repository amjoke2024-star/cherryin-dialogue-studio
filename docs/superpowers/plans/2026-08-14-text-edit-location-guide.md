# 图片改字精确定位图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在图片改字请求中增加带编号选框的临时定位图，让 Image 2 明确识别用户选择的文字区域，同时只保存干净原图。

**Architecture:** `lib/text-edit.ts` 负责筛选实际替换项并生成稳定的编号映射；客户端 Canvas 按原图尺寸绘制红色选框和编号，输出临时 PNG。任务把干净原图作为第 1 张、定位图作为第 2 张提交；定位图标记为 `transient`，服务端仍将它发送给编辑接口，但不会归档或返回到历史记录。

**Tech Stack:** Next.js 16、React 19、TypeScript 5.9、Canvas API、Node test runner。

## Global Constraints

- 干净原图必须是第 1 张参考图，定位图必须是第 2 张参考图。
- 定位图只包含实际填写且发生变化的文字区域，编号从 1 连续递增。
- 提示词必须明确定位图仅用于定位，不得在结果中保留边框、编号或标记颜色。
- 定位图不得写入历史记录或作为“继续改字”的原图。
- 不承诺选区外像素完全不变，不增加局部拼接。
- 不执行付费实时生成测试，除非用户另行确认使用 API 额度。

---

### Task 1: 编号映射与定位提示词

**Files:**
- Modify: `lib/text-edit.ts`
- Modify: `lib/text-edit.test.ts`

**Interfaces:**
- Produces: `textEditGuideRegions(regions: TextRegion[]): Array<{ number: number; region: TextRegion }>`。
- Changes: `buildTextEditPrompt(regions: TextRegion[], options?: { hasGuide?: boolean }): string`。

- [ ] **Step 1:** 写失败测试，断言只筛选有效替换项、连续编号，并在 `hasGuide` 时出现“标记框 1”和“定位图不得出现在结果中”。
- [ ] **Step 2:** 运行 `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test lib/text-edit.test.ts`，确认因导出缺失而失败。
- [ ] **Step 3:** 实现最小纯函数并让测试通过。

### Task 2: 浏览器生成临时定位图

**Files:**
- Create: `lib/text-edit-guide.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `createTextEditGuideImage(source: string, regions: TextRegion[]): Promise<string>`，返回 PNG data URL。

- [ ] **Step 1:** 加载原图到 Canvas，按比例坐标绘制高对比红框、半透明外描边和编号圆点。
- [ ] **Step 2:** 在新图片改字提交通过校验后生成定位图；任务参考图为 `[sourceImage, { name: "文字定位图.png", data: guide, transient: true }]`。
- [ ] **Step 3:** 使用 `buildTextEditPrompt(regions, { hasGuide: true })` 生成逐编号指令；定位图失败时阻止付费提交并显示错误。

### Task 3: 临时参考图不归档

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/api/generate/route.ts`

**Interfaces:**
- Extends: `Attachment` / `Reference` with `transient?: boolean`。

- [ ] **Step 1:** 编辑请求仍将全部参考图传给上游接口。
- [ ] **Step 2:** 归档时过滤 `transient === true`，只返回干净原图。
- [ ] **Step 3:** 运行 `npm test && npm run typecheck && npm run build`；无付费浏览器检查确认页面无报错。
- [ ] **Step 4:** 提交 `git commit -m "feat: add precise text edit location guide"`。
