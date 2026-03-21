/**
 * Shared parchment paper texture for screen backgrounds.
 * Fills canvas with warm parchment base, applies pixel noise for grain,
 * then draws a radial vignette for aged edges.
 */
export function drawPaperGrain(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // 1. Parchment base fill
  ctx.fillStyle = '#d4c5a0';
  ctx.fillRect(0, 0, w, h);

  // 2. Per-pixel noise (±25 per channel) for paper grain
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 50; // ±25
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  // 3. Radial vignette — darken edges
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.max(w, h) * 0.7;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(60, 40, 20, 0)');
  gradient.addColorStop(1, 'rgba(60, 40, 20, 0.35)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}
