/** A seat's place in a half-circle parliament chart; the arc's center is the origin, y up is negative. */
export interface SeatPos {
  x: number;
  y: number;
  angle: number; // radians, π at the far left to 0 at the far right
}

/** How many concentric rows give seats about as much room along a row as between rows. */
export function arcRows(total: number, inner: number, outer: number): number {
  const mid = (inner + outer) / 2;
  const k = ((outer - inner) * total) / (Math.PI * mid); // n(n-1) ≈ k
  return Math.max(2, Math.round((1 + Math.sqrt(1 + 4 * k)) / 2));
}

/** Seat positions in `rows` concentric half-rings between `inner` and `outer`, ordered left to right so a party block fills as a wedge. */
export function arcSeats(total: number, rows: number, inner: number, outer: number): SeatPos[] {
  const radii = Array.from({ length: rows }, (_, i) => inner + (i * (outer - inner)) / (rows - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const raw = radii.map((r) => (total * r) / sum);
  const counts = raw.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  for (const i of raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i)) {
    if (left === 0) break;
    (counts[i] as number) += 1;
    left -= 1;
  }
  const seats: SeatPos[] = [];
  radii.forEach((r, i) => {
    const k = counts[i] as number;
    for (let j = 0; j < k; j++) {
      const angle = k === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (k - 1);
      seats.push({ x: r * Math.cos(angle), y: -r * Math.sin(angle), angle });
    }
  });
  return seats.sort((a, b) => b.angle - a.angle);
}
