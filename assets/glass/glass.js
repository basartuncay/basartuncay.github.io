// Liquid Glass helpers. No dependencies. Copy into the project.
// LiquidGlass.attach(el, { bezel: 24, scale: 60 }) builds a refraction map for el's rounded rect and
// wires an SVG filter used through backdrop-filter: url(#id). Chromium only; elsewhere it marks
// <html data-glass="fallback"> and the CSS keeps the frosted look.

const SVG_NS = 'http://www.w3.org/2000/svg';

function isChromium() {
  const brands = (typeof navigator !== 'undefined' && navigator.userAgentData?.brands?.map((b) => b.brand)) || [];
  return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b));
}

// Signed distance to a rounded rectangle centred at the origin (negative inside).
export function sdRoundRect(x, y, hw, hh, r) {
  const qx = Math.abs(x) - (hw - r);
  const qy = Math.abs(y) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// Per-pixel displacement (dx, dy in -1..1): inside the bezel pixels are pulled inward along the
// edge normal (convex lens look). Pure function so it can be unit-tested.
export function displacementAt(px, py, w, h, radius, bezel) {
  const hw = w / 2, hh = h / 2, r = Math.min(radius, hw, hh), e = 0.5;
  const x = px + 0.5 - hw, y = py + 0.5 - hh;
  const d = -sdRoundRect(x, y, hw, hh, r);
  if (!(d > 0 && d < bezel)) return [0, 0];
  const nx = sdRoundRect(x + e, y, hw, hh, r) - sdRoundRect(x - e, y, hw, hh, r);
  const ny = sdRoundRect(x, y + e, hw, hh, r) - sdRoundRect(x, y - e, hw, hh, r);
  const len = Math.hypot(nx, ny) || 1;
  const t = 1 - d / bezel;   // 1 at the rim, 0 at the inner edge of the bezel
  const m = t * t;           // squared profile: soft inside, strong at the rim
  return [(-nx / len) * m, (-ny / len) * m];
}

// R/G encode x/y offset around 128. Returns a PNG data URL.
export function displacementMap(w, h, radius, bezel) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const [dx, dy] = displacementAt(px, py, w, h, radius, bezel);
      const i = (py * w + px) * 4;
      img.data[i] = 128 + dx * 127;
      img.data[i + 1] = 128 + dy * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

let defs;
function svgDefs() {
  if (defs) return defs;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

let seq = 0;
export const LiquidGlass = {
  attach(el, { bezel = 24, scale = 60, sheen = true } = {}) {
    if (sheen) {
      el.addEventListener('pointermove', (ev) => {
        const b = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((ev.clientX - b.left) / b.width) * 100}%`);
        el.style.setProperty('--my', `${((ev.clientY - b.top) / b.height) * 100}%`);
      });
    }
    if (!isChromium() || matchMedia('(prefers-reduced-transparency: reduce)').matches) {
      document.documentElement.dataset.glass = 'fallback';
      return () => {};
    }
    const id = `lg-${++seq}`;
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const feImage = document.createElementNS(SVG_NS, 'feImage');
    feImage.setAttribute('result', 'map');
    feImage.setAttribute('preserveAspectRatio', 'none');
    const feDisp = document.createElementNS(SVG_NS, 'feDisplacementMap');
    feDisp.setAttribute('in', 'SourceGraphic');
    feDisp.setAttribute('in2', 'map');
    feDisp.setAttribute('scale', String(scale));
    feDisp.setAttribute('xChannelSelector', 'R');
    feDisp.setAttribute('yChannelSelector', 'G');
    filter.append(feImage, feDisp);
    svgDefs().appendChild(filter);

    const build = () => {
      const { width, height } = el.getBoundingClientRect();
      const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      feImage.setAttribute('width', String(w));
      feImage.setAttribute('height', String(h));
      feImage.setAttribute('href', displacementMap(w, h, radius, Math.min(bezel, w / 2, h / 2)));
    };
    build();
    const ro = new ResizeObserver(() => requestAnimationFrame(build));
    ro.observe(el);
    el.style.setProperty('--glass-refract', `url(#${id})`);
    el.dataset.refract = '';
    return () => { ro.disconnect(); filter.remove(); delete el.dataset.refract; };
  },
};

// Damped spring → CSS linear() easing. Returns { easing, duration } (duration in ms).
export function springEasing({ stiffness = 170, damping = 26, mass = 1, points = 32 } = {}) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const pos = (t) => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t); // critically damped (over-damped approximated)
  };
  let settle = 0.05;
  for (let t = 0; t < 10; t += 0.001) if (Math.abs(1 - pos(t)) > 0.001) settle = t;
  const stops = [];
  for (let i = 0; i <= points; i++) stops.push(+pos((settle * i) / points).toFixed(3));
  stops[stops.length - 1] = 1;
  return { easing: `linear(${stops.join(', ')})`, duration: Math.round(settle * 1000) };
}
