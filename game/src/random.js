// A small seeded random source, so a screenshot scene staged from one seed always plays
// out the same way. Nothing in the game reads Math.random during a run.

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max) from the given source. */
export function range(source, min, max) {
  return min + source() * (max - min);
}

/** One of the given values, picked by the source. */
export function pick(source, values) {
  return values[Math.floor(source() * values.length)];
}
