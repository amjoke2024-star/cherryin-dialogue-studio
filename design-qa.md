# Design QA

- Source visual truth: `/var/folders/9b/p433g1pn66q3sqxy8h9fzxgw0000gn/T/codex-clipboard-d049b9cd-dba6-4cb2-ab65-5c2b730166a7.png`
- Implementation screenshot: `/Users/xieyingjun/Documents/Codex/2026-07-27/hua/dialogue-studio/implementation-empty-state.png`
- Source pixels: 2438 × 1642
- Implementation pixels: 1170 × 720
- CSS viewport: 1170 × 720 at device scale 1
- State: source shows a populated three-image result batch; the isolated in-app verification browser has no saved generation history and therefore shows the empty composer state.

## Full-view comparison evidence

The reference was opened and the local implementation was captured. A state-equivalent visual comparison is not possible because generated history belongs to the user's existing browser storage and is absent in the isolated verification browser.

## Focused region comparison evidence

Blocked for the same reason: there is no result thumbnail in the isolated browser to open the new lightbox. Code/build checks passed and the isolated browser reported no console warnings or errors, but those checks are not substitutes for visual interaction evidence.

## Findings

- [P1] Preview interaction cannot be visually exercised in the isolated browser.
  - Location: generated result grid and full-screen lightbox.
  - Evidence: the source contains three generated images; the verification capture contains no generated batch.
  - Impact: full-screen sizing and arrow placement cannot receive a state-matched visual pass in this run.
  - Fix: verify against an existing generated batch in the user's live画室 session.

## Required fidelity surfaces

- Fonts and typography: blocked in lightbox state; existing app typography remains unchanged.
- Spacing and layout rhythm: blocked in lightbox state.
- Colors and visual tokens: implemented from existing dark tokens; state-matched comparison blocked.
- Image quality and asset fidelity: original generated image URLs are used directly with `object-fit: contain`; visual comparison blocked.
- Copy and content: counter, download, close, previous, and next controls are present; state-matched comparison blocked.

## Comparison history

- Initial pass: identified missing populated-result state in the isolated browser. No visual fixes could be responsibly inferred from an empty-state capture.

## Interaction checks represented in implementation

- Thumbnail click opens preview.
- Previous/next buttons wrap within the current batch.
- Left/right arrow keys navigate.
- Escape and backdrop click close.
- Download remains independently clickable.
- TypeScript and production build passed.
- Browser console errors checked: none in the available empty state.

final result: blocked

---

# 图片改字 MVP QA — 2026-08-14

- Verification URL: `http://localhost:3200`
- Desktop viewport: 1280 × 720
- Narrow viewport: 800 × 900
- OCR fixture: `implementation-empty-state.png`（1170 × 720，包含中文、数字与英文）
- Implementation screenshot: `/tmp/image-text-edit-qa.png`
- Narrow screenshot: `/tmp/image-text-edit-narrow-qa.png`
- Paid generation: 未执行

## Functional verification

- “图片生成 / 图片改字”切换可用，原图片生成输入框和工具在切回后保持原结构。
- 图片改字模式文件选择器限制为单张图片。
- 简体中文 OCR 在浏览器内完成，识别出 7 个文字区域；worker、core 和语言数据均从本地 `/ocr/` 路径加载。
- 中文 OCR 字间无意义空格在归一化阶段移除；英文单词间距保留。
- 点击图片文字框后，对应列表项激活并滚入可见区域。
- 填写一处“改成”后，提交按钮从禁用变为可用；未填写替换内容时保持禁用。
- Playwright 鼠标拖动新增第 8 个手动区域，并自动聚焦“原文字（手动框选）”。
- 未点击“开始改字”，没有产生 Image 2 请求或费用。

## Visual review

- First focus: 上传后的原图和文字框是最强视觉主体；识别列表为次级操作区，模式与提交工具为第三层。
- Squint/value check: 深色画布、浅色文本和琥珀色框在灰度层级上仍可区分；已填写替换使用绿色状态，不单靠颜色，仍保留边框与编号。
- Spacing/rhythm: 桌面使用画布/列表双列；窄于 900px 后改为上下排列。区域行沿用 8px 节奏，未增加与现有画室冲突的卡片体系。
- Crop check: 只保留识别进度、数量和必要字段；字号、字重、字距、行距、精细模式和重复说明均未加入第一版。
- Narrow layout evidence: `scrollWidth` 与 `clientWidth` 都为 785px，无横向溢出；列表最大高度为 360px，可独立滚动。

## Known limitations

- Tesseract 对低对比度小字和品牌英文存在误识别，用户可直接修正原文字或手动框选。
- Tesseract core 会把少量不支持的语言参数以 console error 级别输出，但 OCR 正常完成；这是第三方运行时日志，不是应用请求失败。
- Image 2 的实际改字效果和付费任务恢复未在本轮验证，因为测试明确禁止消耗 API 额度。

final result: pass for offline OCR, selection, editing draft, manual box, responsive layout, and submission protection; paid Image 2 output remains intentionally untested
