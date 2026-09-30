/** Optimal string alignment distance: Levenshtein plus adjacent transpositions ("toliet"). */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Snaps a misspelled token to the closest vocabulary word. Guarded so ordinary English is left
 * alone: same first letter, at least 4 letters, distance 1 (2 for long words), and never for
 * words on the keep list, which collide with the vocabulary ("floor" is one edit from "flood").
 */
export function correctToken(token: string, vocab: ReadonlySet<string>, keep: ReadonlySet<string>): string {
  if (token.length < 4 || vocab.has(token) || keep.has(token) || /\d/.test(token)) return token;
  const limit = token.length >= 8 ? 2 : 1;
  let best = token;
  let bestDistance = limit + 1;
  for (const word of vocab) {
    if (word[0] !== token[0] || Math.abs(word.length - token.length) > limit) continue;
    const dist = editDistance(token, word);
    if (dist < bestDistance) {
      best = word;
      bestDistance = dist;
    }
  }
  return best;
}
