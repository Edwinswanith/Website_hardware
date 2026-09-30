"use client";

import { useEffect, useRef, useState } from "react";
import { SEGMENTS } from "./manifest";
import s from "./FilmStrip.module.css";

const pad = (n: number) => String(n).padStart(3, "0");

/** "How this film was made": the clip under your pointer (or the slider), frame by frame. */
export function FilmStrip() {
  const seg = SEGMENTS.find((x) => x.id === "v1");
  const count = seg?.count ?? 1;
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  // Warm the cache once the strip is near, so scrubbing never waits on the network.
  useEffect(() => {
    if (!seg) return;
    const el = box.current!;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const step = matchMedia("(max-width: 899.98px)").matches ? 4 : 1;
      for (let k = 0; k < count; k += step) { const img = new Image(); img.src = `/film/${seg.id}/${pad(k + 1)}.webp`; }
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seg, count]);

  if (!seg) return null;
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    setI(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (count - 1)));
  };
  const sec = ((i / (count - 1)) * 8).toFixed(1);

  return (
    <figure className={s.strip}>
      <div ref={box} className={s.view} onPointerMove={onMove}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/film/${seg.id}/${pad(i + 1)}.webp`} alt={`Frame ${i + 1} of ${count} from the generated film.`} width={seg.width} height={seg.height} loading="lazy" />
        <span className={s.time}>{sec}s / 8.0s</span>
      </div>
      <label className={s.scrub}>
        <span className="sr-only">Scrub through the film</span>
        <input type="range" min={0} max={count - 1} value={i} onChange={(e) => setI(+e.target.value)} />
      </label>
      <figcaption className={s.caption}>Move across the frame, or drag the slider, to step through the eight seconds.</figcaption>
    </figure>
  );
}
