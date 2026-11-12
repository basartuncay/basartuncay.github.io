// Page enhancements shared by / and /automation/. Loaded as a module, so it runs after parsing.
import { LiquidGlass } from "./glass.js";
import { countUp, feed, scramble } from "./fx.js";

document.querySelectorAll(".top nav a").forEach(scramble);
document.querySelectorAll(".figure .from, .figure .to").forEach((el) => countUp(el));
// The ops log becomes an endless feed once its lines have arrived (index.html staggers them 420 ms apart).
const log = document.getElementById("log");
if (log) setTimeout(() => feed(log), 350 + log.children.length * 420 + 800);

// Glass play pill over each poster; the native controls appear once the video plays.
for (const v of document.querySelectorAll(".media video")) {
  const secs = (v.closest(".media").querySelector(".cap")?.textContent.match(/(\d+) seconds/) || [])[1];
  const frame = document.createElement("div");
  frame.className = "frame";
  const b = document.createElement("button");
  b.type = "button";
  b.className = "play glass--thin glass-pill";
  b.setAttribute("aria-label", `Play ${v.getAttribute("aria-label")}${secs ? `, ${secs} seconds` : ""}`);
  b.innerHTML = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9.5-5.5z"/></svg>Play demo${secs ? ` · ${secs} s` : ""}`;
  b.addEventListener("click", () => { v.controls = true; b.hidden = true; v.play().catch(() => {}); v.focus(); });
  v.before(frame);
  frame.append(v, b);
  v.controls = false;
}

// Refraction is built off the critical path; Safari/Firefox keep the frosted fallback.
(window.requestIdleCallback || setTimeout)(() =>
  document.querySelectorAll(".glass--hero").forEach((el) => LiquidGlass.attach(el, { bezel: 14, scale: 36 })));
