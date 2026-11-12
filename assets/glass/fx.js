// Motion helpers to pair with fx.css. No dependencies. Everything is a no-op under reduced motion.
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ%#*/<>01";

// Hover scramble: letters flicker through glyphs and settle left to right (~350 ms). Width is locked so nothing shifts.
export function scramble(el) {
  const text = el.textContent;
  let raf = 0;
  el.addEventListener("pointerenter", () => {
    if (calm()) return;
    cancelAnimationFrame(raf);
    el.style.minWidth = `${el.getBoundingClientRect().width}px`;
    const t0 = performance.now();
    const step = (t) => {
      const done = Math.floor(((t - t0) / 350) * text.length);
      el.textContent = [...text].map((c, i) => (i < done || c === " " ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
      if (done < text.length) raf = requestAnimationFrame(step); else el.textContent = text;
    };
    raf = requestAnimationFrame(step);
  });
}

// Count up from 0 to the element's number when it scrolls into view (ease-out, 1.1 s).
export function countUp(el, ms = 1100) {
  const end = parseFloat(el.textContent);
  if (calm() || !Number.isFinite(end)) return;
  el.textContent = "0";
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      el.textContent = String(Math.round(end * (1 - (1 - p) ** 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, { threshold: 0.6 }).observe(el);
}

// Endless feed: keeps the list's height, doubles its items (copies hidden from screen readers) and scrolls them up forever.
export function feed(list, secondsPerItem = 3) {
  if (calm()) return;
  const n = list.children.length;
  const box = document.createElement("div");
  box.className = "fx-feed";
  box.style.height = `${list.getBoundingClientRect().height}px`;
  list.before(box);
  box.append(list);
  for (const li of [...list.children]) {
    const c = li.cloneNode(true);
    c.setAttribute("aria-hidden", "true");
    list.append(c);
  }
  box.style.setProperty("--fx-feed-s", `${n * secondsPerItem}s`);
  box.classList.add("run");
}
