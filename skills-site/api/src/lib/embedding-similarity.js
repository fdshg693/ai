/**
 * Cosine similarity and top-K selection over precomputed skill embeddings.
 * Pure functions for easy unit testing.
 */

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return Number.NaN;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
      return Number.NaN;
    }
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Rank skills by cosine similarity to the query embedding and return the top K.
 * Skills missing a usable embedding are skipped (caller should reject incomplete indexes).
 *
 * @param {number[]} queryEmbedding
 * @param {Array<{ embedding?: number[], [key: string]: unknown }>} skills
 * @param {number} [k=10]
 * @returns {typeof skills}
 */
export function topKByEmbedding(queryEmbedding, skills, k = 10) {
  if (!Array.isArray(skills) || k <= 0) return [];
  const scored = [];
  for (const skill of skills) {
    const score = cosineSimilarity(queryEmbedding, skill?.embedding);
    if (!Number.isFinite(score)) continue;
    scored.push({ skill, score });
  }
  scored.sort((left, right) => right.score - left.score || String(left.skill.path).localeCompare(String(right.skill.path)));
  return scored.slice(0, k).map(({ skill }) => skill);
}
