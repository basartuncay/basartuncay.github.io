// Frame-time measurement and one-way quality steps for the Core scene.
// ?perf=1 shows the overlay; the same numbers are always on window.__corePerf for automated checks.

export const TIERS = [
  { name: "high", bloom: true, dpr: null }, // dpr null = the device cap (2 desktop, 1.5 phone)
  { name: "no-bloom", bloom: false, dpr: null },
  { name: "dpr-1", bloom: false, dpr: 1 },
  { name: "dpr-0.75", bloom: false, dpr: 0.75 },
];

function pct(sorted, p) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
}

export class Perf {
  constructor({ gl, onTier, show }) {
    this.times = []; // [timestamp, frame ms]
    this.last = 0;
    this.tier = 0;
    this.onTier = onTier;
    this.since = 0; // when the current 2-second judgement window started
    this.renderer = "unknown";
    try {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      this.renderer = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    } catch (_) {}
    this.stats = { median: 0, p95: 0, worst: 0, fps: 0, frames: 0, tier: TIERS[0].name, renderer: this.renderer, steps: [] };
    window.__corePerf = this.stats;
    if (show) {
      this.box = document.createElement("output");
      this.box.className = "perf-overlay";
      this.box.setAttribute("aria-live", "off");
      document.body.appendChild(this.box);
    }
    this.nextReport = 0;
  }
  /** Forget the gap after a pause, so a hidden tab is not read as one long frame. */
  reset() {
    this.last = 0;
    this.since = 0;
  }
  tick(now) {
    if (this.last) {
      const dt = now - this.last;
      this.times.push([now, dt]);
      while (this.times.length && this.times[0][0] < now - 10000) this.times.shift();
      this.judge(now);
      if (now >= this.nextReport) this.report(now);
    } else this.since = now;
    this.last = now;
  }
  judge(now) {
    if (this.tier >= TIERS.length - 1 || now - this.since < 2000) return;
    const win = this.times.filter((s) => s[0] >= now - 2000).map((s) => s[1]).sort((a, b) => a - b);
    if (pct(win, 0.95) > 20) {
      this.tier++;
      this.stats.tier = TIERS[this.tier].name;
      this.stats.steps.push({ at: Math.round(now), to: TIERS[this.tier].name, p95: +pct(win, 0.95).toFixed(1) });
      this.onTier(TIERS[this.tier]);
    }
    this.since = now; // judge each 2-second window once; after a step, the next window starts fresh
  }
  report(now) {
    this.nextReport = now + 500;
    const d = this.times.map((s) => s[1]).sort((a, b) => a - b);
    const med = pct(d, 0.5);
    Object.assign(this.stats, { median: +med.toFixed(2), fps: med ? +(1000 / med).toFixed(1) : 0, p95: +pct(d, 0.95).toFixed(2), worst: +(d[d.length - 1] || 0).toFixed(1), frames: d.length });
    if (this.box) this.box.textContent = `median ${this.stats.fps} fps · p95 ${this.stats.p95} ms · worst ${this.stats.worst} ms · ${this.stats.frames} frames/10 s · tier ${this.stats.tier}\n${this.renderer}`;
  }
}
