"use client";

import { useEffect, useRef } from "react";
import { SEGMENTS } from "./manifest";
import { REGIONS } from "@/content/regions";
import { SERVICES } from "@/content/services";
import { PROCESS, PROMISE, COMPANY } from "@/content/company";
import s from "./Film.module.css";

/* ------------------------------------------------------------------ the timeline
 * One film, scrubbed by scroll. f is progress through the film section, 0..1.
 *   A 0.00–0.40  the hand places the chip (Veo clip v1; phones: stills s1 → s2)
 *   B 0.40–0.62  the camera dives into the chip and comes out on the lit traces (s3)
 *   C 0.62–0.80  the traces hold while the four regions are named
 *   D 0.80–1.00  pull back to the lab (s4) for the process
 * B and D are drawn from stills until their clips are generated and approved. */
const A_END = 0.4, B_END = 0.62, D_START = 0.8;
const CHIP: [number, number] = [0.5, 0.59]; // where the chip sits in the v1 last frame / s2

type Band = { id: string; inA: number; inB: number; outA: number; outB: number };
const BANDS: Band[] = [
  { id: "hero", inA: -1, inB: 0, outA: 0.1, outB: 0.13 },
  { id: "promise", inA: 0.16, inB: 0.19, outA: 0.33, outB: 0.36 },
  { id: "direct", inA: 0.43, inB: 0.46, outA: 0.54, outB: 0.57 },
  { id: "regions", inA: 0.61, inB: 0.64, outA: 0.79, outB: 0.82 },
  { id: "process", inA: 0.86, inB: 0.89, outA: 2, outB: 3 },
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const pad = (n: number) => String(n).padStart(3, "0");

export function Film() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = root.current!;
    const canvas = host.querySelector<HTMLCanvasElement>("[data-canvas]")!;
    const ctx = canvas.getContext("2d")!;
    const loader = document.querySelector<HTMLElement>("[data-loader]");
    const bar = loader?.querySelector<HTMLElement>("[data-bar]");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const phone = matchMedia("(max-width: 899.98px)");
    const bandEls = BANDS.map((b) => host.querySelector<HTMLElement>(`[data-band="${b.id}"]`)!);
    const bandK = BANDS.map(() => -1);

    /* ---------------------------------------------------------- media */
    const seg = SEGMENTS.find((x) => x.id === "v1");
    const frames: (Blob | null)[] = []; // compressed; decoded off the main thread only near the playhead
    const stills: Record<string, HTMLImageElement | null> = { s1: null, s2: null, s3: null, s4: null };
    let useFrames = false;
    let loaded = 0, total = 1;
    let disposed = false;

    function load(src: string) {
      return new Promise<HTMLImageElement | null>((res) => {
        const img = new Image();
        img.decoding = "async";
        img.src = src;
        img.decode().then(() => res(img), () => res(null));
      });
    }
    function tickLoad() {
      loaded++;
      if (bar) bar.style.transform = `scaleX(${clamp(loaded / total).toFixed(3)})`;
      if (loaded >= total) hideLoader();
      wake(true);
    }
    function hideLoader() { loader?.setAttribute("data-done", ""); }

    async function loadMedia() {
      useFrames = Boolean(seg) && !phone.matches && !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      const tall = phone.matches;
      const stillSrc = (k: string) => `/film/stills/${k}-${tall ? "tall" : innerWidth > 1400 ? "1920" : "960"}.webp`;
      // Order: what is on screen first, then coarse-to-fine through the clip, then the later stills.
      const order: number[] = [];
      if (useFrames && seg) {
        frames.length = seg.count;
        frames.fill(null);
        for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < seg.count; i += step) if (!order.includes(i)) order.push(i);
        if (!order.includes(seg.count - 1)) order.push(seg.count - 1);
      }
      total = order.length + 4;
      stills.s1 = await load(stillSrc("s1")); tickLoad();
      const queue = order.slice();
      const worker = async () => {
        while (queue.length && !disposed) {
          const i = queue.shift()!;
          frames[i] = await fetch(`/film/${seg!.id}/${pad(i + 1)}.webp`).then((r) => (r.ok ? r.blob() : null), () => null);
          if (Math.abs(i - playhead) <= 10) keepWindow(playhead);
          tickLoad();
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      for (const k of ["s2", "s3", "s4"]) { stills[k] = await load(stillSrc(k)); tickLoad(); }
    }
    /* A decoded window around the playhead. Blobs decode on a background thread, so a fast scrub
     * never stalls on the main thread; ±10 frames of 1600×900 is ~115 MB, released as it moves on. */
    const decoded = new Map<number, ImageBitmap>();
    const pending = new Set<number>();
    let playhead = 0;
    const nearestDecoded = (i: number) => {
      for (let d = 0; d <= 14; d++) {
        const a = decoded.get(i - d) ?? decoded.get(i + d);
        if (a) return a;
      }
      return null;
    };
    function keepWindow(center: number) {
      playhead = center;
      for (const [i, bm] of decoded) if (Math.abs(i - center) > 14) { bm.close(); decoded.delete(i); }
      for (let d = 0; d <= 10; d++) for (const i of [center + d, center - d]) {
        const blob = frames[i];
        if (!blob || decoded.has(i) || pending.has(i)) continue;
        pending.add(i);
        createImageBitmap(blob).then((bm) => {
          pending.delete(i);
          if (disposed || Math.abs(i - playhead) > 14) { bm.close(); return; }
          decoded.set(i, bm);
          if (Math.abs(i - playhead) <= 2) wake(true);
        }, () => pending.delete(i));
      }
    }

    /* ---------------------------------------------------------- drawing */
    let W = 0, H = 0, dpr = 1;
    function size() {
      W = innerWidth; H = innerHeight;
      // The frames are 1600px wide: a canvas sharper than its source only costs fill rate.
      dpr = Math.min(devicePixelRatio || 1, Math.max(1, 1600 / innerWidth), 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    /** Cover-fit, zoomed by `z` around a focus point that stays put on screen. */
    function cover(img: CanvasImageSource & { width: number; height: number } | null, z = 1, focus: [number, number] = [0.5, 0.5], alpha = 1) {
      if (!img || alpha <= 0) return;
      const iw = img.width, ih = img.height;
      const s0 = Math.max(W / iw, H / ih);
      const d0w = iw * s0, d0h = ih * s0;
      const px = (W - d0w) / 2 + focus[0] * d0w, py = (H - d0h) / 2 + focus[1] * d0h;
      const dw = d0w * z, dh = d0h * z;
      const x = clamp(px - focus[0] * dw, W - dw, 0), y = clamp(py - focus[1] * dh, H - dh, 0);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, x, y, dw, dh);
      ctx.globalAlpha = 1;
    }

    function draw(f: number) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#f4f2ee";
      ctx.fillRect(0, 0, W, H);
      if (useFrames && seg && f >= A_END && f < B_END) keepWindow(seg.count - 1);
      const endOfA = useFrames && seg ? decoded.get(seg.count - 1) ?? nearestDecoded(seg.count - 1) ?? stills.s2 : stills.s2;
      if (f < A_END) {
        const t = f / A_END;
        if (useFrames && seg) {
          const j = Math.round(t * (seg.count - 1));
          keepWindow(j);
          cover(nearestDecoded(j) ?? stills.s1);
        }
        else { cover(stills.s1, 1 + 0.08 * t); cover(stills.s2, 1, [0.5, 0.5], ramp(0.72, 1, t)); }
      } else if (f < B_END) {
        // Dive into the chip, come out on the lit traces.
        const t = (f - A_END) / (B_END - A_END);
        cover(endOfA, 1 + 1.6 * ramp(0, 0.75, t) ** 1.6, CHIP);
        cover(stills.s3, 1.18 - 0.18 * ramp(0.55, 1, t), [0.5, 0.5], ramp(0.55, 0.85, t));
      } else {
        const t = (f - B_END) / (1 - B_END);
        const toLab = ramp(D_START, D_START + 0.07, f);
        if (toLab < 1) cover(stills.s3, 1 + 0.05 * t);
        cover(stills.s4, 1.1 - 0.1 * ramp(D_START, 1, f), [0.5, 0.35], toLab);
      }
    }

    /* ---------------------------------------------------------- bands: fully visible plateaus, short eased ramps */
    function bands(f: number) {
      BANDS.forEach((b, i) => {
        const k = b.inA < 0 ? 1 - ramp(b.outA, b.outB, f) : Math.min(ramp(b.inA, b.inB, f), 1 - ramp(b.outA, b.outB, f));
        const q = Math.round(k * 200) / 200;
        if (q === bandK[i]) return;
        bandK[i] = q;
        bandEls[i].style.setProperty("--k", String(q));
        bandEls[i].toggleAttribute("inert", q < 0.5);
      });
    }

    /* ---------------------------------------------------------- the loop that rests */
    let top = 0, len = 1;
    function measure() {
      const r = host.getBoundingClientRect();
      top = r.top + scrollY; len = Math.max(1, r.height - innerHeight);
      size();
    }
    let target = scrollY, shown = scrollY, raf: number | null = null, last = 0, drawn = -1;
    const progress = (y: number) => clamp((y - top) / len);
    function tick(now: number) {
      const dt = Math.min(100, now - (last || now));
      last = now;
      shown += (target - shown) * (1 - Math.pow(1 - 0.16, dt / 16.667));
      const settled = Math.abs(target - shown) < 0.3;
      if (settled) shown = target;
      const f = progress(shown);
      // Inside the clip only a new frame index is worth a redraw; elsewhere the zooms need fine steps.
      const key = f < A_END && useFrames && seg ? Math.round((f / A_END) * (seg.count - 1)) : Math.round(f * 4000) + 1e5;
      if (key !== drawn || force) { drawn = key; force = false; draw(f); }
      bands(f);
      if (settled) { raf = null; last = 0; } else raf = requestAnimationFrame(tick);
    }
    let force = false;
    function wake(redraw = false) { if (redraw) force = true; if (raf === null) raf = requestAnimationFrame(tick); }
    const onScroll = () => { target = scrollY; wake(); };
    const onResize = () => { measure(); wake(true); };

    function applyMode() {
      const still = reduce.matches;
      host.dataset.mode = still ? "still" : "live";
      if (still) {
        removeEventListener("scroll", onScroll);
        hideLoader();
        bandEls.forEach((el) => { el.style.setProperty("--k", "1"); el.removeAttribute("inert"); });
        return;
      }
      addEventListener("scroll", onScroll, { passive: true });
      measure();
      target = shown = scrollY;
      bandK.fill(-1);
      wake(true);
    }

    const ro = new ResizeObserver(onResize);
    ro.observe(document.documentElement);
    reduce.addEventListener("change", applyMode);
    applyMode();
    if (!reduce.matches) loadMedia();
    const safety = setTimeout(hideLoader, 6000); // the page never waits on media for long

    return () => {
      disposed = true;
      decoded.forEach((bm) => bm.close());
      clearTimeout(safety);
      ro.disconnect();
      removeEventListener("scroll", onScroll);
      reduce.removeEventListener("change", applyMode);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  const still = (k: string) => (
    <picture className={s.bandStill}>
      <source media="(max-width: 899.98px)" srcSet={`/film/stills/${k}-tall.webp`} />
      <img src={`/film/stills/${k}-1920.webp`} alt="" loading={k === "s1" ? "eager" : "lazy"} />
    </picture>
  );

  return (
    <div ref={root} className={s.film} data-mode="live">
      <div className={s.stage}>
        <canvas data-canvas className={s.canvas} aria-hidden="true" />
        <div className={s.poster} aria-hidden="true">{still("s1")}</div>

      <section data-band="hero" className={`${s.band} ${s.light} ${s.hero}`} aria-labelledby="hero-title">
        {still("s1")}
        <div className={s.copy}>
          <p className="label">{PROMISE.eyebrow} · Chennai</p>
          <h1 id="hero-title" className={s.h1}>{PROMISE.headline}</h1>
          <p className={s.lede}>{PROMISE.subline}</p>
          <p className={s.actions}>
            <a className="btn" href="#contact">Start a project</a>
            <a className="btn btn--ghost" href="#work">See the work</a>
          </p>
        </div>
      </section>

      <section data-band="promise" className={`${s.band} ${s.light} ${s.promise}`} aria-labelledby="promise-title">
        {still("s2")}
        <div className={s.copy}>
          <p className="label">What we build</p>
          <h2 id="promise-title" className={s.h2}>Software that runs real operations.</h2>
          <p className={s.lede}>{PROMISE.rest}</p>
        </div>
      </section>

      <section data-band="direct" className={`${s.band} ${s.dark} ${s.direct}`} aria-labelledby="direct-title">
        {still("s3")}
        <div className={s.copy}>
          <p className="label">How we work</p>
          <h2 id="direct-title" className={s.h2}>No account managers between you and the build.</h2>
          <p className={s.lede}>{COMPANY.directAccess}</p>
        </div>
      </section>

      <section data-band="regions" className={`${s.band} ${s.dark} ${s.regions}`} aria-labelledby="regions-title">
        {still("s3")}
        <div className={s.copy}>
          <p className="label">Services</p>
          <h2 id="regions-title" className={s.h2}>Where the signal goes.</h2>
        </div>
        <ol className={s.cards}>
          {REGIONS.map((r, i) => (
            <li key={r.id} className={s.card} style={{ ["--i" as string]: i }}>
              <p className="label">{String(i + 1).padStart(2, "0")} · {r.name}</p>
              <p className={s.cardServices}>{r.serviceSlugs.map((slug) => SERVICES.find((x) => x.slug === slug)!.shortName).join(" · ")}</p>
              <p className={s.cardGrammar}>{r.grammar.join(" → ")}</p>
            </li>
          ))}
        </ol>
      </section>

      <section data-band="process" className={`${s.band} ${s.light} ${s.process}`} aria-labelledby="process-title">
        {still("s4")}
        <div className={s.copy}>
          <p className="label">Process</p>
          <h2 id="process-title" className={s.h2}>Forty-five days, in the open.</h2>
        </div>
        <ol className={s.steps}>
          {PROCESS.map((p, i) => (
            <li key={p.step} style={{ ["--i" as string]: i }}>
              <p className="label">{p.step}{p.title === "Launch" ? " · day 45" : ""}</p>
              <h3 className={s.h3}>{p.title}</h3>
              <p>{p.description}</p>
            </li>
          ))}
        </ol>
      </section>
      </div>
    </div>
  );
}
