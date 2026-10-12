// Color math shared by the validator and the website: WCAG 2.x relative
// luminance and contrast ratio, and alpha compositing for #rrggbbaa colors.

export function rgba(hex) {
  const n = hex.slice(1);
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
    a: n.length === 8 ? parseInt(n.slice(6, 8), 16) / 255 : 1,
  };
}

// Paint a possibly translucent color over an opaque one.
export function over(top, bottom) {
  const t = rgba(top);
  const b = rgba(bottom);
  const mix = (x, y) => Math.round(t.a * x + (1 - t.a) * y).toString(16).padStart(2, "0");
  return `#${mix(t.r, b.r)}${mix(t.g, b.g)}${mix(t.b, b.b)}`;
}

export function luminance(hex) {
  const { r, g, b } = rgba(hex);
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
