// Deterministic finding ids without node:crypto (runs anywhere). Two FNV-1a
// passes with different offsets give a 64-bit hex id; collisions are not a
// concern at demo scale.
function fnv1a(input: string, offset: number): string {
  let h = offset >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function stableId(...parts: string[]): string {
  const s = parts.join("|");
  return fnv1a(s, 0x811c9dc5) + fnv1a(s, 0x050c5d1f);
}
