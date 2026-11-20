/* On an iPhone home-screen app the status bar (time, battery) sits outside the page,
   painted in the theme-color. A dark overlay can't reach it, so while one is open we
   tint the theme-color to the same dimmed shade, and put it back afterwards. */

const BACKDROP = { r: 10, g: 12, b: 15 }; // matches .sheet-backdrop in styles.css

let open = 0;
const saved = new Map<HTMLMetaElement, string>();

function hex(c: string) {
  const n = parseInt(c.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function dim(color: string, alpha: number): string {
  const c = hex(color);
  const mix = (a: number, b: number) => Math.round(a * (1 - alpha) + b * alpha).toString(16).padStart(2, '0');
  return `#${mix(c.r, BACKDROP.r)}${mix(c.g, BACKDROP.g)}${mix(c.b, BACKDROP.b)}`;
}

/* Call when an overlay opens; call the returned function when it closes. */
export function dimStatusBar(alpha = 0.45): () => void {
  if (open++ === 0) {
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      saved.set(m, m.content);
      if (/^#[0-9a-f]{6}$/i.test(m.content)) m.content = dim(m.content, alpha);
    });
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--open === 0) {
      saved.forEach((c, m) => { m.content = c; });
      saved.clear();
    }
  };
}
