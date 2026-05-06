/**
 * kmeans++ over normalized embeddings.
 *
 * HDBSCAN would be the ideal choice (no fixed-k assumption, handles
 * noise) but the Node bindings aren't stable enough for production
 * yet. kmeans++ converges in <20 iterations and is fast for the
 * snapshot's typical few-thousand-chunk scale.
 */
export function kmeansPlusPlus(vectors: number[][], k: number): number[] {
  if (vectors.length === 0) return [];
  const n = vectors.length;
  const dim = vectors[0].length;

  // Pick first center at random; subsequent centers proportional to D².
  const centers: number[][] = [vectors[Math.floor(Math.random() * n)]];
  while (centers.length < Math.min(k, n)) {
    const dists = vectors.map((v) => Math.min(...centers.map((c) => sqDist(v, c))));
    const total = dists.reduce((a, b) => a + b, 0);
    if (total === 0) break;
    const pick = Math.random() * total;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += dists[i];
      if (acc >= pick) {
        centers.push(vectors[i]);
        break;
      }
    }
  }

  const assign = new Array(n).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = sqDist(vectors[i], centers[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; moved = true; }
    }
    if (!moved) break;

    for (let c = 0; c < centers.length; c++) {
      const members = vectors.filter((_, i) => assign[i] === c);
      if (members.length === 0) continue;
      const mean = new Array(dim).fill(0);
      for (const m of members) for (let d = 0; d < dim; d++) mean[d] += m[d];
      for (let d = 0; d < dim; d++) mean[d] /= members.length;
      centers[c] = mean;
    }
  }
  return assign;
}

function sqDist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}
