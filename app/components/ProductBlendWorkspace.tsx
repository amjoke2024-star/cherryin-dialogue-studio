"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  normalizeRegion,
  resizeTextRegionBox,
  type NormalizedBox,
  type ResizeCorner,
} from "../../lib/text-edit";
import {
  isValidProductBox,
  type ProductBlendStep,
  type ProductBlendStyle,
} from "../../lib/product-blend";

type ProductBlendWorkspaceProps = {
  image: { name: string; data: string };
  box: NormalizedBox | null;
  step: ProductBlendStep;
  style: ProductBlendStyle | null;
  additionalPrompt: string;
  busy: boolean;
  onBoxChange(box: NormalizedBox | null): void;
  onStepChange(step: ProductBlendStep): void;
  onStyleChange(style: ProductBlendStyle): void;
  onAdditionalPromptChange(value: string): void;
  onBack(): void;
  onSubmit(): void;
};

type Point = { x: number; y: number };
type Interaction =
  | { kind: "draw"; start: Point }
  | { kind: "move"; start: Point; box: NormalizedBox }
  | { kind: "resize"; corner: ResizeCorner; box: NormalizedBox };

const handles: Array<{ corner: ResizeCorner; label: string }> = [
  { corner: "north-west", label: "调整产品框左上角" },
  { corner: "north-east", label: "调整产品框右上角" },
  { corner: "south-west", label: "调整产品框左下角" },
  { corner: "south-east", label: "调整产品框右下角" },
];

function point(event: ReactPointerEvent<HTMLDivElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

function pointInElement(event: ReactPointerEvent, element: HTMLDivElement | null): Point {
  const rect = element?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

export default function ProductBlendWorkspace(props: ProductBlendWorkspaceProps) {
  const interaction = useRef<Interaction | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const beginDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (props.busy || event.button !== 0 || event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = point(event);
    interaction.current = { kind: "draw", start };
    props.onBoxChange({ x: start.x, y: start.y, width: 0, height: 0 });
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = interaction.current;
    if (!active || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const current = point(event);
    if (active.kind === "draw") {
      props.onBoxChange(normalizeRegion({
        x: active.start.x,
        y: active.start.y,
        width: current.x - active.start.x,
        height: current.y - active.start.y,
      }));
    } else if (active.kind === "resize") {
      props.onBoxChange(resizeTextRegionBox(active.box, active.corner, current));
    } else {
      const dx = current.x - active.start.x;
      const dy = current.y - active.start.y;
      props.onBoxChange({
        ...active.box,
        x: Math.min(1 - active.box.width, Math.max(0, active.box.x + dx)),
        y: Math.min(1 - active.box.height, Math.max(0, active.box.y + dy)),
      });
    }
  };

  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    interaction.current = null;
  };

  const capture = (event: ReactPointerEvent, value: Interaction) => {
    event.preventDefault();
    event.stopPropagation();
    overlayRef.current?.setPointerCapture(event.pointerId);
    interaction.current = value;
  };

  return (
    <section className="product-blend-workspace" aria-label="产品溶图工作区">
      <div className="product-blend-canvas-column">
        <div className="product-blend-canvas-shell">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.image.data} alt={props.image.name} draggable={false} />
          <div
            ref={overlayRef}
            className="product-blend-overlay"
            onPointerDown={beginDraw}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={finish}
          >
            {props.box && (
              <div
                className="product-blend-box"
                aria-label="已框选的产品区域"
                style={{
                  left: `${props.box.x * 100}%`,
                  top: `${props.box.y * 100}%`,
                  width: `${props.box.width * 100}%`,
                  height: `${props.box.height * 100}%`,
                }}
                onPointerDown={(event) => capture(event, {
                  kind: "move",
                  start: pointInElement(event, overlayRef.current),
                  box: props.box!,
                })}
              >
                <span>产品区域</span>
                {handles.map(({ corner, label }) => (
                  <button
                    key={corner}
                    type="button"
                    className={`product-blend-handle is-${corner}`}
                    aria-label={label}
                    onPointerDown={(event) => capture(event, { kind: "resize", corner, box: props.box! })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <p>拖动框选产品区域，可移动选区或拖动四角调整范围。</p>
      </div>

      <div className="product-blend-controls">
        {props.step === "select-region" ? (
          <>
            <header><small>第 1 步，共 2 步</small><strong>框选需要融合的产品</strong></header>
            <p>尽量完整框住产品，周围可以保留少量环境，便于模型判断接触阴影。</p>
            <div className="product-blend-actions">
              <button type="button" onClick={props.onBack}>返回重新选图</button>
              <button
                type="button"
                className="primary"
                disabled={!isValidProductBox(props.box)}
                onClick={() => props.onStepChange("choose-style")}
              >下一步</button>
            </div>
          </>
        ) : (
          <>
            <header><small>第 2 步，共 2 步</small><strong>选择融合方式</strong></header>
            <div className="product-blend-style-options">
              <button
                type="button"
                aria-pressed={props.style === "realistic-lighting"}
                className={props.style === "realistic-lighting" ? "chosen" : ""}
                onClick={() => props.onStyleChange("realistic-lighting")}
              ><strong>真实校光</strong><span>严格保留产品外观，只统一环境光、色温、反射和阴影。</span></button>
              <button
                type="button"
                aria-pressed={props.style === "visual-priority"}
                className={props.style === "visual-priority" ? "chosen" : ""}
                onClick={() => props.onStyleChange("visual-priority")}
              ><strong>视觉优先</strong><span>保留产品核心识别信息，强化材质、高光和广告氛围。</span></button>
            </div>
            <label>
              <span>补充要求（可选）</span>
              <textarea
                value={props.additionalPrompt}
                onChange={(event) => props.onAdditionalPromptChange(event.target.value)}
                placeholder="例如：加强左侧暖光，产品不要变色"
                rows={3}
              />
            </label>
            <div className="product-blend-actions">
              <button type="button" onClick={() => props.onStepChange("select-region")}>返回调整选区</button>
              <button type="button" className="primary" disabled={!props.style || props.busy} onClick={props.onSubmit}>开始溶图</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
