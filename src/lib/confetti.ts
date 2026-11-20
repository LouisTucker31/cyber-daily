/* Lightweight confetti on a <canvas>: paper pieces in the app's medal colours that
   burst out, tumble and fall. No library. */

const COLORS = ['#c2410c', '#f2763a', '#f6d76b', '#e0ad2c', '#d99a62', '#a9cbe0', '#b9c1ca'];

interface Piece {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; rot: number; vr: number; flip: number; vf: number;
  color: string;
}

let canvas: HTMLCanvasElement | null = null;
let pieces: Piece[] = [];
let frame = 0;
let last = 0;

function fit(c: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function add(n: number, x: number, y: number, angle: number, spread: number, speed: [number, number]) {
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const s = speed[0] + Math.random() * (speed[1] - speed[0]);
    pieces.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      w: 6 + Math.random() * 5, h: 9 + Math.random() * 7,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
      flip: Math.random() * Math.PI, vf: 0.12 + Math.random() * 0.2,
      color: COLORS[(Math.random() * COLORS.length) | 0]
    });
  }
}

function tick(now: number) {
  const c = canvas;
  if (!c) return;
  const dt = Math.min(3, (now - last) / 16.67 || 1); // in 60fps frames
  last = now;
  const ctx = c.getContext('2d')!;
  const H = c.clientHeight;
  ctx.clearRect(0, 0, c.clientWidth, H);
  pieces = pieces.filter((p) => p.y < H + 30);
  for (const p of pieces) {
    p.vx *= Math.pow(0.985, dt);
    p.vy = p.vy * Math.pow(0.985, dt) + 0.32 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt; p.flip += p.vf * dt;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.cos(p.flip));
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  frame = pieces.length ? requestAnimationFrame(tick) : 0;
}

/* small: a puff from the point. big: a fountain from the point plus cannons from the bottom corners. */
export function confetti(c: HTMLCanvasElement, at: { x: number; y: number }, size: 'small' | 'big') {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  canvas = c;
  fit(c);
  const up = -Math.PI / 2;
  if (size === 'small') add(45, at.x, at.y, up, Math.PI * 1.6, [4, 9]);
  else {
    add(90, at.x, at.y, up, Math.PI * 1.3, [7, 15]);
    add(40, 0, c.clientHeight, up + 0.55, 0.5, [14, 22]);
    add(40, c.clientWidth, c.clientHeight, up - 0.55, 0.5, [14, 22]);
  }
  if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
}

export function stopConfetti() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0; pieces = []; canvas = null;
}
