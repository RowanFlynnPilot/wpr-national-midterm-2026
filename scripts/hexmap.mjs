// Lay out all 435 House districts as an equal-area hex cartogram.
//
// 1. Each district's target point is the vote-weighted centroid of the counties it
//    covers (from civicAPI's county breakdown, so it reflects the 2026 maps).
// 2. States grow as contiguous hex blobs, each claiming the free frontier hex closest
//    to one of its own district targets, so a state's blob follows its population.
// 3. Inside each blob, districts are assigned to hexes by minimizing squared distance
//    between standardized district targets and hex centers (pairwise-swap descent).
//
// Writes public/data/house-hex.json: [{ d: "WI-03", st: "WI", q, r }]
import { readFileSync, writeFileSync } from "node:fs";
import { geoPath } from "d3-geo";
import { forceCollide, forceSimulation, forceX, forceY } from "d3-force";
import { feature } from "topojson-client";

const HEX = 10.2; // hex circumradius in Albers-USA 975x610 space; tuned so blobs read as the map
const SQ3 = Math.sqrt(3);
const toXY = (q, r) => [HEX * SQ3 * (q + r / 2), HEX * 1.5 * r];
const fromXY = (x, y) => {
  const r = y / (HEX * 1.5);
  const q = x / (HEX * SQ3) - r / 2;
  return axialRound(q, r);
};
function axialRound(q, r) {
  let x = q, z = r, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return [rx, rz];
}
const NEIGHBORS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const key = (q, r) => `${q},${r}`;
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

// --- district targets -------------------------------------------------------
const topo = JSON.parse(readFileSync("public/data/us-albers-10m.json", "utf8"));
const path = geoPath(null);
const countyCentroid = new Map(
  feature(topo, topo.objects.counties).features.map((f) => [f.id, path.centroid(f)]),
);
const ALASKA_SPLIT = { "02063": "02261", "02066": "02261" }; // see pipeline/build.py

const search = JSON.parse(readFileSync("pipeline/raw/search.json", "utf8"));
const districts = search.races
  .filter((r) => r.type === "House of Representatives")
  .map((r) => {
    const detail = JSON.parse(readFileSync(`pipeline/raw/races/${r.id}.json`, "utf8"));
    let wx = 0, wy = 0, w = 0;
    for (const region of Object.values(detail.region_results)) {
      if (!region.fips || region.fips.length !== 5) continue;
      const c = countyCentroid.get(ALASKA_SPLIT[region.fips] ?? region.fips);
      if (!c) throw new Error(`${r.district}: no county geometry for ${region.fips}`);
      const v = region.candidates.reduce((s, c) => s + c.votes, 0) || 1;
      wx += c[0] * v; wy += c[1] * v; w += v;
    }
    if (!w) throw new Error(`${r.district}: no county regions`);
    return { d: r.district, st: r.province, target: [wx / w, wy / w] };
  });
if (districts.length !== 435) throw new Error(`expected 435 districts, got ${districts.length}`);

// --- grow state blobs -------------------------------------------------------
const byState = new Map();
for (const d of districts) {
  if (!byState.has(d.st)) byState.set(d.st, []);
  byState.get(d.st).push(d);
}
const owner = new Map(); // hex key -> state
const blobs = new Map(); // state -> [[q,r]]

// Relax state centers so equal-area blobs touch: shrink the map toward its middle
// (closing the sparse West), then let collisions push dense states (the Northeast) apart.
const SHRINK = 0.60;
const GRAVITY = 0.012; // slides sparse western states inward until they meet a neighbor
const HEX_AREA = 1.5 * SQ3 * HEX * HEX;
const raw = [...byState.entries()].map(([st, ds]) => {
  const cx = ds.reduce((s, d) => s + d.target[0], 0) / ds.length;
  const cy = ds.reduce((s, d) => s + d.target[1], 0) / ds.length;
  return { st, ds, cx, cy, radius: Math.sqrt((ds.length * HEX_AREA) / Math.PI) };
});
const mid = [raw.reduce((s, n) => s + n.cx * n.ds.length, 0) / 435, raw.reduce((s, n) => s + n.cy * n.ds.length, 0) / 435];
const nodes = raw.map((n) => {
  const x = mid[0] + (n.cx - mid[0]) * SHRINK, y = mid[1] + (n.cy - mid[1]) * SHRINK;
  return { ...n, x, y, hx: x, hy: y };
});
forceSimulation(nodes)
  .force("home-x", forceX((n) => n.hx).strength(0.06))
  .force("home-y", forceY((n) => n.hy).strength(0.06))
  .force("gravity-x", forceX(mid[0]).strength(GRAVITY))
  .force("gravity-y", forceY(mid[1]).strength(GRAVITY))
  .force("collide", forceCollide((n) => n.radius * 0.9).strength(1).iterations(4))
  .stop()
  .tick(600);

const states = nodes.map((n) => {
  const centroid = [n.x, n.y];
  // keep each district's offset from its state center, scaled down with the map
  const targets = n.ds.map((d) => [n.x + (d.target[0] - n.cx) * SHRINK, n.y + (d.target[1] - n.cy) * SHRINK]);
  return { st: n.st, need: n.ds.length, targets, centroid };
});

function nearestFree(point) {
  const [q0, r0] = fromXY(...point);
  for (let ring = 0; ring < 60; ring++) {
    let best = null;
    for (let dq = -ring; dq <= ring; dq++) {
      for (let dr = -ring; dr <= ring; dr++) {
        if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) !== ring) continue;
        const q = q0 + dq, r = r0 + dr;
        if (owner.has(key(q, r))) continue;
        const d = dist2(toXY(q, r), point);
        if (!best || d < best.d) best = { q, r, d };
      }
    }
    if (best) return [best.q, best.r];
  }
  throw new Error("no free hex near point");
}
function claim(s, q, r) {
  owner.set(key(q, r), s.st);
  blobs.get(s.st).push([q, r]);
}
function cost(s, q, r) {
  const p = toXY(q, r);
  let best = Infinity;
  for (const t of s.targets) best = Math.min(best, dist2(p, t));
  return best + 0.15 * dist2(p, s.centroid); // mild pull toward the state center keeps blobs compact
}

[...states].sort((a, b) => b.need - a.need).forEach((s) => {
  blobs.set(s.st, []);
  claim(s, ...nearestFree(s.centroid));
});
function frontierSize(s) {
  const seen = new Set();
  for (const [q, r] of blobs.get(s.st)) {
    for (const [dq, dr] of NEIGHBORS) {
      const k = key(q + dq, r + dr);
      if (!owner.has(k)) seen.add(k);
    }
  }
  return seen.size;
}
for (;;) {
  const open = states.filter((s) => blobs.get(s.st).length < s.need);
  if (!open.length) break;
  // A state about to be boxed in (fewer free neighbors than hexes it still needs) moves first;
  // otherwise the least-filled state grows, so neighbors expand at the same pace.
  const urgency = (s) => frontierSize(s) - (s.need - blobs.get(s.st).length);
  open.sort((a, b) => {
    const ua = urgency(a), ub = urgency(b);
    if ((ua < 3) !== (ub < 3)) return ua < 3 ? -1 : 1;
    if (ua < 3) return ua - ub;
    return blobs.get(a.st).length / a.need - blobs.get(b.st).length / b.need || b.need - a.need;
  });
  const s = open[0];
  let best = null;
  for (const [q, r] of blobs.get(s.st)) {
    for (const [dq, dr] of NEIGHBORS) {
      const nq = q + dq, nr = r + dr;
      if (owner.has(key(nq, nr))) continue;
      const c = cost(s, nq, nr);
      if (!best || c < best.c) best = { q: nq, r: nr, c };
    }
  }
  if (!best) throw new Error(`${s.st} is enclosed with ${blobs.get(s.st).length}/${s.need} hexes`);
  claim(s, best.q, best.r);
}

// --- fill interior holes ----------------------------------------------------
// Growth can leave free hexes enclosed by blobs. Each hole goes to the neighbor that
// touches it most, and that state releases its worst-placed exterior hex (removal must
// keep the blob connected) so every state keeps exactly as many hexes as districts.
function exteriorFree() {
  const cells = [...owner.keys()].map((k) => k.split(",").map(Number));
  const lo = [Math.min(...cells.map((c) => c[0])) - 2, Math.min(...cells.map((c) => c[1])) - 2];
  const hi = [Math.max(...cells.map((c) => c[0])) + 2, Math.max(...cells.map((c) => c[1])) + 2];
  const seen = new Set();
  const stack = [lo];
  while (stack.length) {
    const [q, r] = stack.pop();
    const k = key(q, r);
    if (seen.has(k) || owner.has(k) || q < lo[0] || q > hi[0] || r < lo[1] || r > hi[1]) continue;
    seen.add(k);
    for (const [dq, dr] of NEIGHBORS) stack.push([q + dq, r + dr]);
  }
  return seen;
}
function holes() {
  const exterior = exteriorFree();
  const out = new Set();
  for (const k of owner.keys()) {
    const [q, r] = k.split(",").map(Number);
    for (const [dq, dr] of NEIGHBORS) {
      const nk = key(q + dq, r + dr);
      if (!owner.has(nk) && !exterior.has(nk)) out.add(nk);
    }
  }
  return out;
}
function connectedWithout(st, dropKey) {
  const cells = blobs.get(st).filter(([q, r]) => key(q, r) !== dropKey);
  const seen = new Set([key(...cells[0])]);
  const stack = [cells[0]];
  while (stack.length) {
    const [q, r] = stack.pop();
    for (const [dq, dr] of NEIGHBORS) {
      const nk = key(q + dq, r + dr);
      if (owner.get(nk) === st && nk !== dropKey && !seen.has(nk)) {
        seen.add(nk);
        stack.push([q + dq, r + dr]);
      }
    }
  }
  return seen.size === cells.length;
}
// A landlocked state has no exterior hex to give up, so it releases an interior one
// bordering another state instead; that becomes the next hole and the shift ripples
// outward until a state on the coast absorbs it. A state may not reclaim what it just gave up.
const gaveUp = new Map(); // hex key -> state that released it
for (let pass = 0; ; pass++) {
  const open = holes();
  if (!open.size) break;
  if (pass > 2000) throw new Error(`could not fill holes: ${[...open].join(" ")}`);
  const hk = [...open][0];
  const [hq, hr] = hk.split(",").map(Number);
  const touching = new Map();
  for (const [dq, dr] of NEIGHBORS) {
    const st = owner.get(key(hq + dq, hr + dr));
    if (st && gaveUp.get(hk) !== st) touching.set(st, (touching.get(st) ?? 0) + 1);
  }
  const st = [...touching.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const s = states.find((x) => x.st === st);
  const exterior = exteriorFree();
  const bordersOther = ([q, r]) => NEIGHBORS.some(([dq, dr]) => owner.has(key(q + dq, r + dr)) && owner.get(key(q + dq, r + dr)) !== st);
  const releasable = blobs.get(st).filter(([q, r]) => key(q, r) !== hk && connectedWithout(st, key(q, r)));
  const byCost = (a, b) => cost(s, ...b) - cost(s, ...a);
  const release =
    releasable.filter(([q, r]) => NEIGHBORS.some(([dq, dr]) => exterior.has(key(q + dq, r + dr)))).sort(byCost)[0] ??
    releasable.filter(bordersOther).sort(byCost)[0];
  if (!release) throw new Error(`${st} cannot release a hex to fill the hole at ${hk}`);
  owner.delete(key(...release));
  blobs.set(st, blobs.get(st).filter(([q, r]) => key(q, r) !== key(...release)));
  gaveUp.set(key(...release), st);
  claim(s, hq, hr);
}

// --- assign districts to hexes inside each blob -----------------------------
function standardize(points) {
  const n = points.length;
  const m = [0, 1].map((i) => points.reduce((s, p) => s + p[i], 0) / n);
  const sd = [0, 1].map((i) => Math.sqrt(points.reduce((s, p) => s + (p[i] - m[i]) ** 2, 0) / n) || 1);
  return points.map((p) => [(p[0] - m[0]) / sd[0], (p[1] - m[1]) / sd[1]]);
}
const out = [];
for (const [st, ds] of byState) {
  ds.sort((a, b) => a.d.localeCompare(b.d, "en", { numeric: true }));
  const hexes = blobs.get(st);
  const T = standardize(ds.map((d) => d.target));
  const H = standardize(hexes.map(([q, r]) => toXY(q, r)));
  const assign = ds.map((_, i) => i); // district i -> hex assign[i]
  for (let improved = true; improved; ) {
    improved = false;
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        const now = dist2(T[i], H[assign[i]]) + dist2(T[j], H[assign[j]]);
        const swapped = dist2(T[i], H[assign[j]]) + dist2(T[j], H[assign[i]]);
        if (swapped + 1e-9 < now) {
          [assign[i], assign[j]] = [assign[j], assign[i]];
          improved = true;
        }
      }
    }
  }
  ds.forEach((d, i) => out.push({ d: d.d, st, q: hexes[assign[i]][0], r: hexes[assign[i]][1] }));
}

writeFileSync("public/data/house-hex.json", JSON.stringify(out));
console.log(`placed ${out.length} districts`);
