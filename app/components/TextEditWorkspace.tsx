"use client";

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { copyText } from "../../lib/clipboard";
import { normalizeRegion, type NormalizedBox, type TextRegion } from "../../lib/text-edit";

type ReferenceImage = { name: string; data: string };

export type TextEditWorkspaceProps = {
  image: ReferenceImage;
  regions: TextRegion[];
  activeId: string | null;
  recognizing: boolean;
  progress: number;
  onBack(): void;
  onActiveChange(id: string | null): void;
  onRegionsChange(regions: TextRegion[]): void;
};

type Point = { x: number; y: number };

function pointerPosition(event: ReactPointerEvent<HTMLDivElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

function draftBox(start: Point, end: Point): NormalizedBox {
  return normalizeRegion({
    x: start.x,
    y: start.y,
    width: end.x - start.x,
    height: end.y - start.y,
  });
}

export default function TextEditWorkspace({
  image,
  regions,
  activeId,
  recognizing,
  progress,
  onBack,
  onActiveChange,
  onRegionsChange,
}: TextEditWorkspaceProps) {
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragEnd, setDragEnd] = useState<Point | null>(null);
  const [copyStatus, setCopyStatus] = useState<Record<string, "copied" | "failed">>({});
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const listRefs = useRef(new Map<string, HTMLDivElement>());

  const updateRegion = (id: string, patch: Partial<TextRegion>) => {
    onRegionsChange(regions.map((region) => region.id === id ? { ...region, ...patch } : region));
  };

  const activate = (id: string) => {
    onActiveChange(id);
    listRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (recognizing || event.button !== 0 || event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    setDragStart(point);
    setDragEnd(point);
    onActiveChange(null);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setDragEnd(pointerPosition(event));
  };

  const finishDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart || !dragEnd) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const box = draftBox(dragStart, dragEnd);
    setDragStart(null);
    setDragEnd(null);
    if (box.width < 0.01 || box.height < 0.01) return;

    const id = crypto.randomUUID();
    onRegionsChange([...regions, { id, text: "", replacement: "", box, source: "manual" }]);
    onActiveChange(id);
    requestAnimationFrame(() => inputRefs.current.get(id)?.focus());
  };

  const currentDraft = dragStart && dragEnd ? draftBox(dragStart, dragEnd) : null;

  const copyOriginalText = async (id: string, value: string) => {
    const copied = await copyText(value);
    setCopyStatus((current) => ({ ...current, [id]: copied ? "copied" : "failed" }));
    window.setTimeout(() => {
      setCopyStatus((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }, 1600);
  };

  return (
    <section className="text-edit-workspace" aria-label="图片改字工作区">
      <div className="text-edit-workspace-actions">
        <button type="button" className="text-edit-back" onClick={onBack}>
          <span aria-hidden="true">←</span>
          返回重新选图
        </button>
      </div>
      <div className="text-edit-canvas-column">
        <div className="text-edit-canvas-shell">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.data} alt={image.name} className="text-edit-source-image" draggable={false} />
          <div
            className={`text-edit-overlay${recognizing ? " is-recognizing" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishDrawing}
            onPointerCancel={() => { setDragStart(null); setDragEnd(null); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { setDragStart(null); setDragEnd(null); }
            }}
          >
            {regions.map((region, index) => (
              <button
                type="button"
                key={region.id}
                className={`text-region-box${activeId === region.id ? " is-active" : ""}${region.replacement.trim() ? " has-replacement" : ""}`}
                style={{
                  left: `${region.box.x * 100}%`,
                  top: `${region.box.y * 100}%`,
                  width: `${region.box.width * 100}%`,
                  height: `${region.box.height * 100}%`,
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => activate(region.id)}
                aria-label={`选择文字 ${region.text || index + 1}`}
              >
                <span>{index + 1}</span>
              </button>
            ))}
            {currentDraft && (
              <div
                className="text-region-draft"
                style={{
                  left: `${currentDraft.x * 100}%`,
                  top: `${currentDraft.y * 100}%`,
                  width: `${currentDraft.width * 100}%`,
                  height: `${currentDraft.height * 100}%`,
                }}
              />
            )}
          </div>
        </div>

        <div className="text-edit-canvas-help">
          {recognizing ? (
            <>
              <span>正在本机识别文字</span>
              <div className="text-edit-progress" aria-label={`识别进度 ${Math.round(progress * 100)}%`}>
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <strong>{Math.round(progress * 100)}%</strong>
            </>
          ) : (
            <span>点击文字框修改；没有识别到的文字可直接在图片上拖框。</span>
          )}
        </div>
      </div>

      <div className="text-edit-list-column">
        <header>
          <div>
            <strong>识别到的文字</strong>
            <small>{regions.length ? `${regions.length} 处` : "等待识别"}</small>
          </div>
          <span>只填写需要替换的内容</span>
        </header>

        <div className="text-edit-region-list">
          {!recognizing && regions.length === 0 && (
            <div className="text-edit-empty">
              <strong>没有识别到文字</strong>
              <span>请在左侧图片上拖动，手动框选要修改的位置。</span>
            </div>
          )}
          {regions.map((region, index) => (
            <div
              key={region.id}
              ref={(node) => {
                if (node) listRefs.current.set(region.id, node);
                else listRefs.current.delete(region.id);
              }}
              className={`text-edit-region-row${activeId === region.id ? " is-active" : ""}`}
              onClick={() => activate(region.id)}
            >
              <span className="text-edit-region-index">{index + 1}</span>
              <label>
                <span>原文字{region.source === "manual" ? "（手动框选）" : ""}</span>
                <input
                  value={region.text}
                  disabled={recognizing}
                  placeholder="原文字"
                  readOnly
                  onFocus={() => activate(region.id)}
                />
                <button
                  type="button"
                  className={`text-edit-copy${copyStatus[region.id] ? ` is-${copyStatus[region.id]}` : ""}`}
                  disabled={recognizing || !region.text}
                  onClick={(event) => {
                    event.stopPropagation();
                    void copyOriginalText(region.id, region.text);
                  }}
                >
                  {copyStatus[region.id] === "copied" ? "已复制" : copyStatus[region.id] === "failed" ? "复制失败" : "复制"}
                </button>
              </label>
              <label>
                <span>改成</span>
                <input
                  ref={(node) => {
                    if (node) inputRefs.current.set(region.id, node);
                    else inputRefs.current.delete(region.id);
                  }}
                  value={region.replacement}
                  disabled={recognizing}
                  placeholder="输入新文字"
                  onFocus={() => activate(region.id)}
                  onChange={(event) => updateRegion(region.id, { replacement: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="text-edit-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  onRegionsChange(regions.filter((item) => item.id !== region.id));
                  if (activeId === region.id) onActiveChange(null);
                }}
                aria-label={`删除文字区域 ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
