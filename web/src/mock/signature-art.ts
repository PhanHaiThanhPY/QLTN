/**
 * Deterministic hand-drawn looking signature for seed data, as an SVG data URL.
 * Seeding runs without a canvas, so the pad's PNG output is replaced by an equivalent vector image.
 */
export const signatureDataUrl = (name: string): string => {
  const codes = [...name].map((char) => char.charCodeAt(0));
  let x = 20;
  const segments = codes.slice(0, 14).map((code, index) => {
    x += 14 + (code % 9);
    const y = 50 + ((code * (index + 3)) % 34) - 17;
    const cy = 50 - ((code * 7) % 30) + 15;
    return `Q ${x - 7} ${cy} ${x} ${y}`;
  });
  const path = `M 20 52 ${segments.join(' ')}`;
  const underline = `M 24 ${78} L ${Math.min(x + 20, 300)} ${74}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="100" viewBox="0 0 320 100"><path d="${path}" fill="none" stroke="#0f1b2d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="${underline}" fill="none" stroke="#0f1b2d" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
