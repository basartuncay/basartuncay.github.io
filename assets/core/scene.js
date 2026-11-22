// System Core scene, shared by the home page hero and /core/.
// Every moving or glowing part stands for something in the job list (see the legend in MARKS below).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { parse, perDay, fixedMinutes, berlin, nextRun } from "./schedule.js";
import { Perf, TIERS } from "./perf.js";

// The palette was authored as display values (as in the r128 original), so colours pass through untouched:
// no sRGB decode on input, no encode on output, no tone mapping.
THREE.ColorManagement.enabled = false;

export const MARKS = {
  core: "the machine all jobs run on; its surface flow speed follows the total scheduled starts per minute",
  orbits: "one ring per group (5); orbit speed follows that group's scheduled starts per day (log scale)",
  nodes: "one per job (22); paused jobs are hollow red and carry no packets",
  packets: "travel from a job to the core; count and speed follow how often the job is scheduled; none for on-demand or paused jobs",
  gyro: "three rings around the core, one per runner (launchd, cron, manual); spin rate follows how many jobs it runs",
  dial: "the floor is a 24-hour dial in Berlin time: hour ticks, a mark at each fixed daily or weekly start, a hand at the current time with the last hour shaded",
  cage: "frame mark",
  scan: "scanline mark",
  lattice: "grid mark (static dot lattice)",
};

export const MOODS = {
  hud: {
    deep: [0.004, 0.03, 0.055], mid: [0.02, 0.2, 0.31], vein: [0.43, 0.89, 1.0], rim: [0.43, 0.89, 1.0], hot: [1, 1, 1],
    halo: 0x2fb9e6, haloOp: 0.42, hotSprite: 0xcdf6ff, line: 0x6fe3ff, lineK: 1, node: 0x6fe3ff, paused: 0xff6b6b,
    runner: [0x6fe3ff, 0x7dffb0, 0x6fe3ff], scan: 0xffffff, dial: 0x6fe3ff, mark: 0x7dffb0, sel: 0xffffff,
    now: [0.43, 0.89, 1.0], grid: [0.75, 0.93, 1.0], bloom: 0.5,
  },
  gothic: {
    deep: [0.03, 0.006, 0.008], mid: [0.2, 0.17, 0.15], vein: [0.95, 0.91, 0.84], rim: [0.86, 0.06, 0.11], hot: [1, 0.72, 0.66],
    halo: 0x8f0b16, haloOp: 0.5, hotSprite: 0xffd8cc, line: 0xe9e4d8, lineK: 0.7, node: 0x6fe3ff, paused: 0xff4d5a,
    runner: [0xc1121f, 0xc1121f, 0xe9e4d8], scan: 0xe9e4d8, dial: 0xc1121f, mark: 0xe9e4d8, sel: 0xe9e4d8,
    now: [0.86, 0.07, 0.12], grid: [0.91, 0.87, 0.8], bloom: 0.45,
  },
};

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
 const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
 vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
 vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
 i=mod289(i);
 vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
 float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
 vec4 j=p-49.0*floor(p*ns.z*ns.z);
 vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
 vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
 vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
 vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
 p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
 vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
 return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;
const CORE_V = NOISE + `
uniform float uTime; varying vec3 vN; varying vec3 vP; varying vec3 vO;
void main(){
 float d=snoise(normal*1.4+vec3(0.0,uTime*0.2,0.0))*0.055+snoise(normal*3.6-vec3(uTime*0.3))*0.022;
 vec3 p=position+normal*d; vO=normal;
 vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(p,1.0); vP=mv.xyz;
 gl_Position=projectionMatrix*mv;
}`;
// dark body, thin glowing veins along noise zero-lines, fresnel rim; colours come from the mood
const CORE_F = NOISE + `
uniform float uTime; uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uVein; uniform vec3 uRim; uniform vec3 uHot;
varying vec3 vN; varying vec3 vP; varying vec3 vO;
void main(){
 vec3 v=normalize(-vP); float f=pow(1.0-max(dot(normalize(vN),v),0.0),2.2);
 float n1=snoise(vO*2.3+vec3(0.0,uTime*0.18,0.0));
 float n2=snoise(vO*5.5-vec3(uTime*0.25));
 float vein=smoothstep(0.085,0.0,abs(n1+n2*0.35));
 float cell=smoothstep(-0.2,0.7,n1);
 vec3 col=mix(uDeep,uMid,cell*0.6);
 col+=uVein*vein*(0.85+0.35*sin(uTime*2.0+n2*6.0));
 col+=uRim*f*0.85+uHot*pow(f,5.0)*0.55;
 gl_FragColor=vec4(min(col,vec3(1.0)),1.0);
}`;
// the last hour on the 24-hour dial, behind the current-time hand
const SWEEP_V = "varying vec2 vXY; void main(){ vXY=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
const SWEEP_F = `
uniform float uAngle; uniform vec3 uColor; uniform float uFade; varying vec2 vXY;
void main(){ float r=length(vXY); float a=atan(vXY.x,vXY.y); if(a<0.0) a+=6.2831853;
 float d=mod(uAngle-a,6.2831853); float w=6.2831853/24.0; float s=d<w?pow(1.0-d/w,2.0):0.0;
 float edge=smoothstep(10.5,7.0,r)*smoothstep(1.5,2.0,r);
 gl_FragColor=vec4(uColor,s*0.22*edge*uFade); }`;
const DOT_V = `uniform float uPx; uniform float uSize; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);
 gl_PointSize=uSize*uPx*(60.0/-mv.z); gl_Position=projectionMatrix*mv; }`;
const DOT_F = `uniform vec3 uColor; uniform float uAlpha; void main(){ float d=length(gl_PointCoord-0.5);
 gl_FragColor=vec4(uColor,smoothstep(0.5,0.1,d)*uAlpha); }`;

const RAD = [2.35, 3.05, 3.75, 4.5, 5.3];
const TILT = [[0.38, 0.12], [-0.24, 0.3], [0.12, -0.2], [-0.08, -0.34], [0.3, 0.22]];
const RUNNERS = ["launchd", "cron", "manual"];
const dialPoint = (min, r) => { const a = (min / 1440) * Math.PI * 2; return [Math.sin(a) * r, 0, -Math.cos(a) * r]; };

/**
 * opts: canvas, data ({groups, nodes}), mood, reduce, mode ("hero" | "full"), phone, perf (show overlay), onSelect(i), onFrame(api)
 * api.view: pull 0..1 (camera backs off and turns top-down), endSize (css px of the whole system at pull 1),
 *           anchor {x,y} (where the core sits in the full frame), full {w,h} and crop {x,y} (the canvas is a window into that frame).
 */
export function createCore(opts) {
  const { canvas, data, mode = "full", phone = false } = opts;
  const reduce = !!opts.reduce;
  const nodes = data.nodes.map((n, i) => ({ ...n, i, sched: parse(n.schedule), ring: data.groups.findIndex((g) => g.key === n.group) }));
  const N = nodes.length;
  let P = MOODS[opts.mood] || MOODS.hud;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x04070c, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04070c, 0.03);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1200);
  const ADD = THREE.AdditiveBlending;

  const glow = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.18, "rgba(255,255,255,.6)");
    r.addColorStop(0.5, "rgba(255,255,255,.13)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const sprite = (color, scale, op, noDepth) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, blending: ADD, transparent: true, opacity: op, depthWrite: false, depthTest: !noDepth }));
    s.scale.set(scale, scale, 1); return s;
  };
  const geoFrom = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); return g; };
  const circle = (r, seg) => { const p = []; for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; p.push(Math.cos(a) * r, 0, Math.sin(a) * r); } return geoFrom(p); };
  const lineMats = []; // [material, base opacity] that take the mood's line colour
  const lineMat = (op, color) => { const m = new THREE.LineBasicMaterial({ color: color ?? P.line, transparent: true, opacity: op, blending: ADD, depthWrite: false }); if (color === undefined) lineMats.push([m, op]); return m; };

  const world = new THREE.Group(); scene.add(world);
  const CORE = new THREE.Vector3();

  // core
  const v3 = (a) => new THREE.Vector3(...a);
  const coreU = { uTime: { value: 0 }, uDeep: { value: v3(P.deep) }, uMid: { value: v3(P.mid) }, uVein: { value: v3(P.vein) }, uRim: { value: v3(P.rim) }, uHot: { value: v3(P.hot) } };
  world.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, phone ? 12 : 20), new THREE.ShaderMaterial({ uniforms: coreU, vertexShader: CORE_V, fragmentShader: CORE_F })));
  const cage = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.36, 2)), lineMat(0.2)); world.add(cage);
  const halo = sprite(P.halo, 7.6, P.haloOp, false); world.add(halo);
  const hot = sprite(P.hotSprite, 3.0, 0.12, true); world.add(hot);
  const scan = new THREE.LineLoop(circle(1, 120), lineMat(0.75, P.scan)); world.add(scan);

  // runners: one gyro ring each, spin by job count
  const runnerCount = RUNNERS.map((r) => nodes.filter((n) => n.runsOn === r).length);
  const gyro = RUNNERS.map((r, k) => {
    const l = new THREE.LineLoop(circle(1.56 + k * 0.17, 160), new THREE.LineBasicMaterial({ color: P.runner[k], transparent: true, opacity: 0.25 + 0.4 * Math.min(1, runnerCount[k] / 10), blending: ADD, depthWrite: false }));
    l.rotation.set(k * 1.1 + 0.4, k * 0.7, 0); world.add(l); return l;
  });
  const gyroSpeed = runnerCount.map((c) => 0.08 + c * 0.03);

  // orbits: one per group; speed from the group's scheduled starts per day
  const rings = data.groups.map((g, k) => {
    const grp = new THREE.Group(); grp.rotation.set(TILT[k][0], 0, TILT[k][1]);
    grp.add(new THREE.LineLoop(circle(RAD[k], 220), lineMat(0.17))); world.add(grp); return grp;
  });
  const ringSpeed = data.groups.map((g, k) => {
    const rpd = nodes.filter((n) => n.ring === k && n.state === "scheduled").reduce((s, n) => s + Math.min(1440, perDay(n.sched)), 0);
    return (k % 2 ? -1 : 1) * (0.03 + 0.035 * Math.log10(1 + rpd));
  });
  const count = data.groups.map(() => 0), total = data.groups.map((g, k) => nodes.filter((n) => n.ring === k).length);
  const hits = [];
  const nodeColor = (n) => new THREE.Color(n.state === "paused" ? P.paused : P.node);
  const objs = nodes.map((n) => {
    const slot = count[n.ring]++, col = nodeColor(n), g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: col, wireframe: n.state === "paused" }));
    g.add(m);
    const s = sprite(col, 0.8, n.state === "paused" ? 0.45 : 0.95, false); g.add(s);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(phone ? 0.5 : 0.36, 8, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.userData.i = n.i; g.add(hit); hits.push(hit);
    rings[n.ring].add(g);
    const rate = n.state === "paused" ? 0 : Math.min(1440, perDay(n.sched));
    return { g, m, s, col, pulse: 0, phase: (slot / total[n.ring]) * Math.PI * 2 + n.ring * 0.9, wp: new THREE.Vector3(), ang: 0,
      packets: rate === 0 ? 0 : rate >= 24 ? 3 : 1, pspeed: rate === 0 ? 0 : 0.06 + 0.05 * Math.log10(1 + rate), linkK: n.state === "paused" ? 0.08 : rate === 0 ? 0.15 : 0.3 };
  });

  // trails behind every node, in its ring's space
  const TR = 22, STEP = 0.03;
  const trails = rings.map((g, ri) => {
    const ks = nodes.filter((n) => n.ring === ri).map((n) => n.i);
    const pos = new Float32Array(ks.length * TR * 6), col = new Float32Array(ks.length * TR * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const ls = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: ADD, depthWrite: false }));
    ls.frustumCulled = false; g.add(ls);
    return { ks, pos, col, geo, dir: ringSpeed[ri] > 0 ? 1 : -1, rad: RAD[ri] };
  });
  const paintTrails = () => trails.forEach((T) => {
    T.ks.forEach((k, a) => { const c = objs[k].col; for (let s = 0; s < TR; s++) {
      const j = (a * TR + s) * 6, f0 = Math.pow(1 - s / TR, 2) * 0.9, f1 = Math.pow(1 - (s + 1) / TR, 2) * 0.9;
      T.col.set([c.r * f0, c.g * f0, c.b * f0, c.r * f1, c.g * f1, c.b * f1], j); } });
    T.geo.attributes.color.needsUpdate = true;
  });
  paintTrails();

  // shock rings: when a job is selected or a fixed start time passes during the visit
  const shocks = [0, 1, 2, 3, 4, 5].map(() => { const l = new THREE.LineLoop(circle(0.3, 40), lineMat(0, 0xffffff)); l.visible = false; scene.add(l); return { l, life: 0, k: 0 }; });
  let shockAt = 0;

  // links core <-> job and packets on them
  const PK = 3;
  const linkPos = new Float32Array(N * 6), linkCol = new Float32Array(N * 6);
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPos, 3)); linkGeo.setAttribute("color", new THREE.BufferAttribute(linkCol, 3));
  const links = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, blending: ADD, depthWrite: false }));
  links.frustumCulled = false; scene.add(links);
  const pkPos = new Float32Array(N * PK * 3), pkCol = new Float32Array(N * PK * 3);
  const pkGeo = new THREE.BufferGeometry();
  pkGeo.setAttribute("position", new THREE.BufferAttribute(pkPos, 3)); pkGeo.setAttribute("color", new THREE.BufferAttribute(pkCol, 3));
  const paintPackets = () => { objs.forEach((o, k) => { for (let q = 0; q < PK; q++) pkCol.set(q < o.packets ? [o.col.r, o.col.g, o.col.b] : [0, 0, 0], (k * PK + q) * 3); }); pkGeo.attributes.color.needsUpdate = true; };
  paintPackets();
  const packets = new THREE.Points(pkGeo, new THREE.PointsMaterial({ size: 0.2, map: glow, vertexColors: true, transparent: true, blending: ADD, depthWrite: false, sizeAttenuation: true }));
  packets.frustumCulled = false; scene.add(packets);

  // floor: 24-hour dial in Berlin time
  const floor = new THREE.Group(); floor.position.y = -2.7; scene.add(floor);
  const fl = [];
  for (let r = 1.5; r <= 10.5; r += 1.5) for (let i = 0; i < 96; i++) fl.push(...dialPoint((i / 96) * 1440, r), ...dialPoint(((i + 1) / 96) * 1440, r));
  for (let h = 0; h < 24; h++) fl.push(...dialPoint(h * 60, 1.5), ...dialPoint(h * 60, 10.5));
  const gridLines = new THREE.LineSegments(geoFrom(fl), lineMat(0.12)); floor.add(gridLines);
  const tk = [];
  for (let q = 0; q < 96; q++) { const big = q % 24 === 0 ? 0.9 : q % 4 === 0 ? 0.45 : 0.18; tk.push(...dialPoint(q * 15, 6), ...dialPoint(q * 15, 6 + big)); }
  const ticks = new THREE.LineSegments(geoFrom(tk), lineMat(0.42)); floor.add(ticks);
  const allFixed = []; nodes.forEach((n) => fixedMinutes(n.sched).forEach((m) => allFixed.push(...dialPoint(m, 7.05), ...dialPoint(m, 7.7))));
  const marks = new THREE.LineSegments(geoFrom(allFixed), new THREE.LineBasicMaterial({ color: P.mark, transparent: true, opacity: 0.65, blending: ADD, depthWrite: false })); floor.add(marks);
  const selGeo = new THREE.BufferGeometry(); selGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(1440 * 6), 3)); selGeo.setDrawRange(0, 0);
  const selMarks = new THREE.LineSegments(selGeo, new THREE.LineBasicMaterial({ color: P.sel, transparent: true, opacity: 0.95, blending: ADD, depthWrite: false }));
  selMarks.frustumCulled = false; floor.add(selMarks);
  const handGeo = geoFrom([0, 0, 0, 0, 0, 0]);
  const hand = new THREE.LineSegments(handGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(...P.now), transparent: true, opacity: 0.9, blending: ADD, depthWrite: false })); floor.add(hand);
  const sweepU = { uAngle: { value: 0 }, uColor: { value: v3(P.now) }, uFade: { value: 1 } };
  const sweep = new THREE.Mesh(new THREE.RingGeometry(1.5, 10.5, 96, 1), new THREE.ShaderMaterial({ uniforms: sweepU, vertexShader: SWEEP_V, fragmentShader: SWEEP_F, transparent: true, blending: ADD, depthWrite: false, side: THREE.DoubleSide }));
  sweep.rotation.x = -Math.PI / 2; floor.add(sweep);
  const setNow = () => {
    const w = berlin(new Date()), min = w.h * 60 + w.mi + w.s / 60;
    handGeo.attributes.position.array.set([...dialPoint(min, 1.5), ...dialPoint(min, 10.5)]); handGeo.attributes.position.needsUpdate = true;
    sweepU.uAngle.value = (min / 1440) * Math.PI * 2;
  };
  setNow();

  // lattice: a static dot grid on a far sphere
  const lat = [];
  for (let a = 1; a < 18; a++) for (let b = 0; b < 36; b++) { const t = (a / 18) * Math.PI, f = (b / 36) * Math.PI * 2; lat.push(Math.sin(t) * Math.cos(f) * 34, Math.cos(t) * 34, Math.sin(t) * Math.sin(f) * 34); }
  const dotU = { uPx: { value: 1 }, uSize: { value: 2.4 }, uColor: { value: v3(P.grid) }, uAlpha: { value: 0.32 } };
  const lattice = new THREE.Points(geoFrom(lat), new THREE.ShaderMaterial({ uniforms: dotU, vertexShader: DOT_V, fragmentShader: DOT_F, transparent: true, blending: ADD, depthWrite: false }));
  lattice.frustumCulled = false; scene.add(lattice);

  const selRing = new THREE.LineLoop(circle(0.3, 48), lineMat(0.9, P.sel)); selRing.visible = false; scene.add(selRing);

  // post-processing: 8-bit targets like the r128 original, bloom at half the drawing-buffer size (UnrealBloomPass halves internally)
  let composer = null, bloom = null, bloomOn = true;
  try {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType }));
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), P.bloom, 0.5, 0.18);
    composer.addPass(bloom);
    // r187 blurs in half-float targets, which lets additive sprites pile up far past 1.0; 8-bit targets give the r128 look back (and halve the bandwidth)
    [bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical].forEach((rt) => { rt.texture.type = THREE.UnsignedByteType; rt.dispose(); });
  } catch (_) { composer = null; }

  // quality
  const dprCap = phone ? 1.5 : 2;
  let tier = TIERS[0], W = 0, H = 0;
  const perf = new Perf({ gl: renderer.getContext(), show: !!opts.perf, onTier: (t) => { tier = t; bloomOn = t.bloom; W = 0; } });
  if (opts.saveData) { tier = TIERS[1]; bloomOn = false; }
  function size() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    if (w === W && h === H) return;
    W = w; H = h;
    const pr = Math.min(window.devicePixelRatio || 1, tier.dpr ?? dprCap);
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(W, H); }
    dotU.uPx.value = pr;
  }

  // camera
  const view = { pull: 0, endSize: 0, anchor: null, full: null, crop: null };
  let theta = mode === "hero" ? 0.55 : 0.7, phi = mode === "hero" ? 1.18 : 1.2, zoom = 1, vth = 0, intro = reduce ? 0 : 1;
  const theta0 = theta;
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  const look = new THREE.Vector3(), tmp = new THREE.Vector3();
  let sel = -1, drag = null;

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const rc = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(hits, false); return h.length ? h[0].object.userData.i : -1;
  }
  const interactive = () => view.pull < 0.05;
  canvas.addEventListener("pointerdown", (e) => { if (!interactive()) return; drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; });
  canvas.addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 6 && !drag.cap) { drag.cap = true; try { canvas.setPointerCapture(drag.id); } catch (_) {} }
      theta -= dx * 0.006; vth = -dx * 0.006;
      if (mode === "hero") theta = Math.min(theta0 + 0.9, Math.max(theta0 - 0.9, theta));
      if (e.pointerType === "mouse" || mode === "full") phi = Math.min(mode === "hero" ? 1.4 : 1.5, Math.max(mode === "hero" ? 0.9 : 0.45, phi - dy * 0.004));
      wake();
    } else if (e.pointerType === "mouse" && interactive()) canvas.style.cursor = pick(e) >= 0 ? "pointer" : "grab";
  });
  const release = (e) => { if (drag && drag.moved < 6) { const k = pick(e); select(k, true); } drag = null; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", () => { drag = null; });
  if (mode === "full") canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoom = Math.min(1.5, Math.max(0.7, zoom + e.deltaY * 0.0012)); wake(); }, { passive: false });
  if (mode === "hero" && !reduce) window.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") return; par.tx = (e.clientX / innerWidth - 0.5) * 2; par.ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

  function select(i, fromUser) {
    sel = i;
    const pos = selGeo.attributes.position.array; let c = 0;
    if (i >= 0) {
      const p = nodes[i].sched;
      const put = (m, r0, r1) => { pos.set([...dialPoint(m, r0), ...dialPoint(m, r1)], c); c += 6; };
      if (nodes[i].state === "scheduled") {
        if (p.kind === "daily" || p.kind === "weekly") put(p.h * 60 + p.m, 6.9, 8.6);
        else if (p.kind === "interval" && p.min >= 5) for (let m = 0; m < 1440; m += p.min) put(m, 7.05, 7.5);
        else if (p.kind === "interval" || p.kind === "always") for (let m = 0; m < 1440; m += 5) { pos.set([...dialPoint(m, 7.25), ...dialPoint(m + 5, 7.25)], c); c += 6; }
      }
      objs[i].pulse = 1; shock(i);
    }
    selGeo.setDrawRange(0, c / 3); selGeo.attributes.position.needsUpdate = true;
    if (opts.onSelect) opts.onSelect(i, !!fromUser);
    wake();
  }
  function shock(k) { const S = shocks[shockAt++ % shocks.length]; S.life = 1; S.k = k; S.l.material.color.copy(objs[k].col); }

  // fixed starts that pass while the page is open: the job's node sends a ring (the schedule says it starts now; nothing is claimed about the run)
  let due = nodes.map((n) => nextRun(n.sched, new Date(), n.state));
  const clock = setInterval(() => {
    const now = new Date(); setNow();
    due.forEach((d, k) => { if (d && now >= d) { objs[k].pulse = 1; shock(k); due[k] = nextRun(nodes[k].sched, now, nodes[k].state); } });
  }, 1000);

  function setMood(name) {
    P = MOODS[name] || MOODS.hud;
    ["deep", "mid", "vein", "rim", "hot"].forEach((k) => coreU["u" + k[0].toUpperCase() + k.slice(1)].value.set(...P[k]));
    lineMats.forEach(([m, op]) => { m.color.set(P.line); m.opacity = op * P.lineK; });
    halo.material.color.set(P.halo); halo.material.opacity = P.haloOp; hot.material.color.set(P.hotSprite);
    scan.material.color.set(P.scan); selRing.material.color.set(P.sel); selMarks.material.color.set(P.sel); marks.material.color.set(P.mark);
    gyro.forEach((l, k) => l.material.color.set(P.runner[k]));
    hand.material.color.setRGB(...P.now); sweepU.uColor.value.set(...P.now); dotU.uColor.value.set(...P.grid);
    nodes.forEach((n, k) => { objs[k].col.copy(nodeColor(n)); objs[k].m.material.color.copy(objs[k].col); objs[k].s.material.color.copy(objs[k].col); });
    paintTrails(); paintPackets();
    if (bloom) bloom.strength = P.bloom;
    wake();
  }

  // loop: runs only while visible; under reduced motion one frame per change
  let running = false, raf = 0, t = 0, last = 0, visible = true;
  function wake() { if (reduce) { if (!raf) raf = requestAnimationFrame((n) => { raf = 0; frame(n, true); }); return; } start(); }
  function start() { if (running || document.hidden || !visible) return; running = true; last = 0; perf.reset(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }
  function loop(now) { if (!running) return; frame(now, false); raf = requestAnimationFrame(loop); }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; visible ? start() : stop(); }).observe(canvas);

  const api = { select, setMood, view, nodes, start, stop, perf: perf.stats, marks: MARKS, frames: 0,
    screen(i) { tmp.copy(objs[i].wp).project(camera); return { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H, visible: tmp.z < 1 }; },
    get selected() { return sel; } };

  function frame(now, still) {
    if (opts.beforeFrame) opts.beforeFrame(api);
    size();
    const dt = still || !last ? 0 : Math.min((now - last) / 1000, 0.05); last = now;
    if (!still) perf.tick(now);
    const mv = reduce ? 0 : 1; t += dt * mv;
    coreU.uTime.value = 4 + t * (0.6 + 0.1 * Math.log10(1 + nodes.reduce((s, n) => s + (n.state === "scheduled" ? Math.min(1440, perDay(n.sched)) : 0), 0) / 1440));
    intro = Math.max(0, intro - dt * 0.5);
    cage.rotation.y = 0.3 + t * 0.12; cage.rotation.x = 0.2 + t * 0.07;
    gyro.forEach((l, k) => { l.rotation.y += dt * gyroSpeed[k] * (k % 2 ? -1 : 1); });
    const sy = Math.sin(0.6 + t * 0.7) * 1.12, sr = Math.sqrt(1.46 * 1.46 - sy * sy); scan.position.y = sy; scan.scale.set(sr, 1, sr);

    // camera
    const e = view.pull, ee = e * e * (3 - 2 * e);
    if (!drag && mode === "full") { theta += dt * 0.07 * mv + vth; vth *= 0.92; }
    else if (!drag) { theta += vth; vth *= 0.9; }
    par.x += (par.tx - par.x) * Math.min(1, dt * 3); par.y += (par.ty - par.y) * Math.min(1, dt * 3);
    if (sel >= 0) tmp.copy(objs[sel].wp).multiplyScalar(0.28 * (1 - ee)); else tmp.set(0, 0, 0);
    look.lerp(tmp, still ? 1 : Math.min(1, dt * 2.2));
    const fw = view.full ? view.full.w : W, fh = view.full ? view.full.h : H;
    const narrow = fw / fh < 0.8;
    const R0 = (narrow ? 15.5 : 8.9) * zoom * (1 + intro * intro * 1.6);
    const Rend = view.endSize ? (2 * 5.6 * fh) / (view.endSize * 2 * Math.tan((21 * Math.PI) / 180)) : R0;
    const R = R0 * Math.pow(Rend / R0, ee);
    const ph = phi + par.y * 0.06 * (1 - ee), th = theta - intro * intro * 1.2 + par.x * 0.12 * (1 - ee);
    const phE = ph + (0.3 - ph) * ee, lookY = (mode === "full" && narrow ? -1.6 : -0.25) * (1 - ee);
    camera.position.set(R * Math.sin(phE) * Math.sin(th), R * Math.cos(phE), R * Math.sin(phE) * Math.cos(th));
    camera.aspect = fw / fh; camera.clearViewOffset(); camera.updateProjectionMatrix();
    camera.lookAt(look.x, look.y + lookY, look.z); camera.updateMatrixWorld();
    let dx = 0, dy = 0;
    if (view.anchor) { tmp.copy(CORE).project(camera); dx = view.anchor.x - (tmp.x * 0.5 + 0.5) * fw; dy = view.anchor.y - (-tmp.y * 0.5 + 0.5) * fh; }
    const cx = view.crop ? view.crop.x : 0, cy = view.crop ? view.crop.y : 0;
    if (dx || dy || view.crop || view.full) camera.setViewOffset(fw, fh, cx - dx, cy - dy, W, H);
    scene.fog.density = 0.03 * (1 - ee);
    floor.visible = ee < 0.98; lattice.visible = ee < 0.98;
    lineMats.forEach(([m, op]) => { if (m === gridLines.material || m === ticks.material) m.opacity = op * P.lineK * (1 - ee); });
    marks.material.opacity = 0.65 * (1 - ee); hand.material.opacity = 0.9 * (1 - ee); sweepU.uFade.value = 1 - ee; dotU.uAlpha.value = 0.32 * (1 - ee);

    for (let k = 0; k < N; k++) {
      const o = objs[k], n = nodes[k]; o.ang = o.phase + t * ringSpeed[n.ring];
      o.g.position.set(Math.cos(o.ang) * RAD[n.ring], 0, Math.sin(o.ang) * RAD[n.ring]);
      o.m.rotation.y = t * 1.6; o.pulse = Math.max(0, o.pulse - dt * 1.1);
      const sc = 0.8 + o.pulse * 1.1 + (k === sel ? 0.4 : 0) + ee * 0.6; o.s.scale.set(sc, sc, 1);
    }
    for (const T of trails) {
      T.ks.forEach((k, a) => { const base = objs[k].ang; for (let s = 0; s < TR; s++) {
        const j = (a * TR + s) * 6, x0 = base - T.dir * s * STEP, x1 = base - T.dir * (s + 1) * STEP;
        T.pos[j] = Math.cos(x0) * T.rad; T.pos[j + 1] = 0; T.pos[j + 2] = Math.sin(x0) * T.rad;
        T.pos[j + 3] = Math.cos(x1) * T.rad; T.pos[j + 4] = 0; T.pos[j + 5] = Math.sin(x1) * T.rad; } });
      T.geo.attributes.position.needsUpdate = true;
    }
    scene.updateMatrixWorld();
    for (let k = 0; k < N; k++) {
      const o = objs[k]; o.g.getWorldPosition(o.wp);
      const j = k * 6, c0 = 0.05, c1 = o.linkK + o.pulse * 0.7 + (k === sel ? 0.4 : 0);
      linkPos.set([0, 0, 0, o.wp.x, o.wp.y, o.wp.z], j);
      linkCol.set([o.col.r * c0, o.col.g * c0, o.col.b * c0, o.col.r * c1, o.col.g * c1, o.col.b * c1], j);
      for (let q = 0; q < PK; q++) {
        const f = o.packets ? (t * (o.pspeed + q * 0.035) + k * 0.37 + q / PK) % 1 : 0, jj = (k * PK + q) * 3;
        pkPos[jj] = o.wp.x * (1 - f); pkPos[jj + 1] = o.wp.y * (1 - f); pkPos[jj + 2] = o.wp.z * (1 - f);
      }
    }
    linkGeo.attributes.position.needsUpdate = true; linkGeo.attributes.color.needsUpdate = true; pkGeo.attributes.position.needsUpdate = true;
    selRing.visible = sel >= 0 && ee < 0.5;
    if (sel >= 0) {
      const o = objs[sel]; selRing.position.copy(o.wp); selRing.quaternion.copy(camera.quaternion); selRing.rotateX(Math.PI / 2);
      const s2 = 1 + Math.sin(t * 4) * 0.08; selRing.scale.set(s2, s2, s2);
    }
    for (const S of shocks) {
      if (S.life <= 0) { S.l.visible = false; continue; }
      S.life -= dt * 1.3; const q = 1 - Math.max(0, S.life), sc2 = 1 + q * 5;
      S.l.visible = !reduce; S.l.position.copy(objs[S.k].wp); S.l.quaternion.copy(camera.quaternion); S.l.rotateX(Math.PI / 2);
      S.l.scale.set(sc2, sc2, sc2); S.l.material.opacity = Math.max(0, S.life) * 0.9;
    }
    if (composer && bloomOn) composer.render(); else renderer.render(scene, camera);
    api.frames++;
    if (opts.onFrame) opts.onFrame(api);
  }

  size();
  select(opts.initial ?? -1, false);
  if (reduce) wake(); else start();
  window.addEventListener("pagehide", () => clearInterval(clock));
  return api;
}
