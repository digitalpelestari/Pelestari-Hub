/**
 * lib/fuzzyMatch.ts
 *
 * Fuzzy string matching untuk data import Excel.
 *
 * Strategi:
 * 1. Exact match setelah normalisasi
 * 2. Token similarity
 * 3. Bigram similarity
 * 4. Character similarity
 * 5. Kandidat hanya diterima jika:
 *    - skor minimum terpenuhi
 *    - tidak terlalu dekat dengan kandidat kedua
 */

function normalize(text: string): string {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokens(text: string): string[] {
    const normalized = normalize(text);

    if (!normalized) {
        return [];
    }

    return normalized
        .split(" ")
        .filter(Boolean);
}

function uniqueTokens(text: string): string[] {
    return [...new Set(tokens(text))];
}

function bigrams(text: string): string[] {
    const clean = normalize(text).replace(/\s/g, "");

    if (clean.length < 2) {
        return clean ? [clean] : [];
    }

    const result: string[] = [];

    for (let i = 0; i < clean.length - 1; i++) {
        result.push(clean.substring(i, i + 2));
    }

    return result;
}

/**
 * Sørensen-Dice coefficient.
 *
 * 0 = tidak mirip
 * 1 = identik
 */
function bigramSimilarity(a: string, b: string): number {
    const bigramsA = bigrams(a);
    const bigramsB = bigrams(b);

    if (bigramsA.length === 0 || bigramsB.length === 0) {
        return 0;
    }

    const bucket = new Map<string, number>();

    for (const bg of bigramsB) {
        bucket.set(bg, (bucket.get(bg) || 0) + 1);
    }

    let intersection = 0;

    for (const bg of bigramsA) {
        const count = bucket.get(bg) || 0;

        if (count > 0) {
            intersection++;
            bucket.set(bg, count - 1);
        }
    }

    return (
        (2 * intersection) /
        (bigramsA.length + bigramsB.length)
    );
}

/**
 * Similarity berdasarkan token/kata.
 *
 * Contoh:
 *
 * "Biaya Perjalanan Dinas"
 * "Perjalanan Dinas"
 *
 * tetap mendapatkan skor tinggi karena token pentingnya sama.
 */
function tokenSimilarity(a: string, b: string): number {
    const tokensA = uniqueTokens(a);
    const tokensB = uniqueTokens(b);

    if (tokensA.length === 0 || tokensB.length === 0) {
        return 0;
    }

    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    let intersection = 0;

    for (const token of setA) {
        if (setB.has(token)) {
            intersection++;
        }
    }

    const union = new Set([
        ...tokensA,
        ...tokensB,
    ]).size;

    if (union === 0) {
        return 0;
    }

    return intersection / union;
}

/**
 * Mengukur apakah salah satu teks mengandung seluruh teks lainnya.
 *
 * Contoh:
 *
 * "BBM"
 * "Biaya BBM Kendaraan"
 *
 * akan mendapatkan bonus.
 */
function containmentSimilarity(a: string, b: string): number {
    const na = normalize(a);
    const nb = normalize(b);

    if (!na || !nb) {
        return 0;
    }

    if (na === nb) {
        return 1;
    }

    if (na.includes(nb) || nb.includes(na)) {
        const shorter = Math.min(
            na.length,
            nb.length
        );

        const longer = Math.max(
            na.length,
            nb.length
        );

        return shorter / longer;
    }

    return 0;
}

/**
 * Similarity utama.
 *
 * Bobot:
 * - Token       45%
 * - Bigram      35%
 * - Containment 20%
 */
export function similarity(
    a: string,
    b: string
): number {
    if (!a || !b) {
        return 0;
    }

    const na = normalize(a);
    const nb = normalize(b);

    if (!na || !nb) {
        return 0;
    }

    if (na === nb) {
        return 1;
    }

    const tokenScore = tokenSimilarity(na, nb);
    const bigramScore = bigramSimilarity(na, nb);
    const containmentScore = containmentSimilarity(na, nb);

    const score =
        tokenScore * 0.45 +
        bigramScore * 0.35 +
        containmentScore * 0.20;

    return Number(score.toFixed(4));
}

export interface FuzzyCandidate<T> {
    item: T;
    label: string;
}

export interface FuzzyMatchResult<T> {
    item: T;
    label: string;
    score: number;

    /**
     * Skor kandidat terbaik kedua.
     */
    secondScore: number;

    /**
     * Jarak skor kandidat terbaik dengan kandidat kedua.
     */
    scoreGap: number;
}

interface InternalCandidate<T> {
    item: T;
    label: string;
    score: number;
}

/**
 * Cari kandidat terbaik.
 *
 * Tidak hanya melihat skor tertinggi.
 * Kita juga melihat jarak dengan kandidat kedua.
 *
 * Contoh:
 *
 * A = 0.81
 * B = 0.80
 *
 * Walaupun A paling tinggi, hasil dianggap ambigu.
 */
export function findBestMatch<T>(
    query: string | null | undefined,
    candidates: FuzzyCandidate<T>[],
    threshold: number = 0.50,
    minimumGap: number = 0.08
): FuzzyMatchResult<T> | null {
    if (
        !query ||
        !query.trim() ||
        candidates.length === 0
    ) {
        return null;
    }

    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
        return null;
    }

    /*
     * ============================================
     * 1. EXACT MATCH
     * ============================================
     *
     * Exact match selalu menang.
     */
    const exact = candidates.find(
        (candidate) =>
            normalize(candidate.label) === normalizedQuery
    );

    if (exact) {
        return {
            item: exact.item,
            label: exact.label,
            score: 1,
            secondScore: 0,
            scoreGap: 1,
        };
    }

    /*
     * ============================================
     * 2. HITUNG SEMUA KANDIDAT
     * ============================================
     */
    const scored: InternalCandidate<T>[] =
        candidates.map((candidate) => ({
            item: candidate.item,
            label: candidate.label,
            score: similarity(
                normalizedQuery,
                candidate.label
            ),
        }));

    /*
     * ============================================
     * 3. SORT
     * ============================================
     */
    scored.sort(
        (a, b) => b.score - a.score
    );

    const best = scored[0];

    if (!best) {
        return null;
    }

    const second = scored[1];

    const secondScore = second
        ? second.score
        : 0;

    const scoreGap =
        best.score - secondScore;

    /*
     * ============================================
     * 4. THRESHOLD
     * ============================================
     */
    if (best.score < threshold) {
        return null;
    }

    /*
     * ============================================
     * 5. AMBIGUOUS MATCH
     * ============================================
     *
     * Kalau dua kandidat terlalu dekat,
     * jangan memaksakan pilihan.
     */
    if (
        second &&
        scoreGap < minimumGap
    ) {
        return null;
    }

    return {
        item: best.item,
        label: best.label,
        score: Number(best.score.toFixed(2)),
        secondScore: Number(
            secondScore.toFixed(2)
        ),
        scoreGap: Number(
            scoreGap.toFixed(2)
        ),
    };
}