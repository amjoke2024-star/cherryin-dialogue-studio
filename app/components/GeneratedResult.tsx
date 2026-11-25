"use client";

import { useEffect, useRef, useState } from "react";

export default function GeneratedResult({ src, alt, downloadName, onOpen, onUseReference, statusLabel }: {
  src: string; alt: string; downloadName: string; onOpen: () => void; onUseReference?: () => void; statusLabel?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [image, setImage] = useState<string>();
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!frame.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let active = true;
    setImage(undefined);
    setDimensions(null);
    setState("loading");
    timer.current = setTimeout(() => {
      controller.abort();
      if (active) setState("error");
    }, 20000);
    const match = src.match(/^\/generated\/([a-zA-Z0-9-]+\.(?:png|jpg|jpeg|webp))$/);
    if (match) {
      void (async () => {
        try {
          const response = await fetch(`/api/image-preview/${match[1]}`, {
            signal: controller.signal,
            cache: attempt ? "reload" : "default",
          });
          if (!response.ok) throw new Error("Preview unavailable");
          const blob = await response.blob();
          if (!active || controller.signal.aborted) return;
          const width = Number(response.headers.get("X-Image-Width"));
          const height = Number(response.headers.get("X-Image-Height"));
          if (width > 0 && height > 0) setDimensions({ width, height });
          objectUrl = URL.createObjectURL(blob);
          setImage(objectUrl);
        } catch {
          if (active) { clearTimeout(timer.current); setState("error"); }
        }
      })();
    } else {
      setImage(src);
    }
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer.current);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, visible, attempt]);

  return (
    <figure className="generated-result">
      <div ref={frame} className="result-image-frame" onClick={onOpen}>
        {image && state !== "error" && <img src={image} alt={alt} decoding="async"
          onLoad={(event) => {
            clearTimeout(timer.current);
            const target = event.currentTarget;
            setDimensions((original) => original ?? { width: target.naturalWidth, height: target.naturalHeight });
            setState("ready");
          }}
          onError={() => { clearTimeout(timer.current); setState("error"); }}
        />}
        {state === "error" && <div className="result-load-message" role="status">
          <span>图片加载失败</span>
          <button type="button" onClick={(event) => { event.stopPropagation(); setAttempt((value) => value + 1); }}>重新加载</button>
        </div>}
        {(state === "idle" || state === "loading") && <div className="result-load-message" aria-live="polite">
          {state === "idle" ? "图片待加载" : "图片加载中…"}
        </div>}
        {statusLabel && <b className="result-status-label">{statusLabel}</b>}
        {onUseReference && (
          <button type="button" className="result-use-reference" onClick={(event) => {
            event.stopPropagation();
            onUseReference();
          }}>用作参考</button>
        )}
        <a href={src} download={downloadName} onClick={(event) => event.stopPropagation()}>下载</a>
      </div>
      <figcaption>{state === "error" ? "可重试加载，或点击查看原图" : dimensions
        ? `${dimensions.width} × ${dimensions.height} px` : state === "idle" ? "滚动到此处加载" : "加载预览中…"}</figcaption>
    </figure>
  );
}
