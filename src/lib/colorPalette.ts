export type RgbColor = { r: number; g: number; b: number };

function clamp(v: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function luminance(c: RgbColor) {
  const toLin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLin(c.r) + 0.7152 * toLin(c.g) + 0.0722 * toLin(c.b);
}

function saturation(c: RgbColor) {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  return max === 0 ? 0 : (max - min) / max;
}

function keyFor(c: RgbColor) {
  return `${clamp(c.r / 20) * 20},${clamp(c.g / 20) * 20},${clamp(c.b / 20) * 20}`;
}

function parseKey(key: string): RgbColor {
  const [r, g, b] = key.split(",").map((v) => clamp(Number(v)));
  return { r, g, b };
}

export function rgbCss(c: RgbColor, alpha = 1) {
  if (alpha >= 1) return `rgb(${clamp(c.r)} ${clamp(c.g)} ${clamp(c.b)})`;
  return `rgb(${clamp(c.r)} ${clamp(c.g)} ${clamp(c.b)} / ${Math.max(0, Math.min(1, alpha))})`;
}

export function mix(a: RgbColor, b: RgbColor, t: number): RgbColor {
  const k = Math.max(0, Math.min(1, t));
  return {
    r: clamp(a.r + (b.r - a.r) * k),
    g: clamp(a.g + (b.g - a.g) * k),
    b: clamp(a.b + (b.b - a.b) * k),
  };
}

export function contrastText(c: RgbColor): string {
  return luminance(c) > 0.52 ? "rgb(10 10 10)" : "rgb(250 250 250)";
}

export function contrastRatio(a: RgbColor, b: RgbColor) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function ensureReadableText(bg: RgbColor) {
  const black = { r: 10, g: 10, b: 10 };
  const white = { r: 250, g: 250, b: 250 };
  const blackRatio = contrastRatio(bg, black);
  const whiteRatio = contrastRatio(bg, white);
  return blackRatio >= whiteRatio ? "rgb(10 10 10)" : "rgb(250 250 250)";
}

export async function extractPaletteFromImage(imageUrl: string, sampleSize = 64): Promise<RgbColor[]> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
  const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 24) continue;
    const c = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const l = luminance(c);
    if (l < 0.03 || l > 0.97) continue;
    const key = keyFor(c);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const ranked = Array.from(counts.entries())
    .map(([key, count]) => ({ color: parseKey(key), count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return saturation(b.color) - saturation(a.color);
    })
    .map((r) => r.color);

  if (ranked.length === 0) return [];
  const [primary, ...rest] = ranked;
  const distinct: RgbColor[] = [primary];
  rest.forEach((c) => {
    if (distinct.length >= 3) return;
    const tooClose = distinct.some((d) => Math.abs(d.r - c.r) + Math.abs(d.g - c.g) + Math.abs(d.b - c.b) < 70);
    if (!tooClose) distinct.push(c);
  });
  return distinct.slice(0, 3);
}
