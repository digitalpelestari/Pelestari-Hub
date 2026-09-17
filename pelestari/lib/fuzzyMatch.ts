/**
 * lib/fuzzyMatch.ts
 * Fuzzy string matching sederhana (Sørensen-Dice coefficient berbasis bigram).
 * Dipakai untuk mencocokkan teks bebas dari Excel (mis. "Jenis Pekerjaan",
 * "Kelompok Biaya") ke master data (nama akun / nama kelompok biaya) tanpa
 * perlu exact match.
 */

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function bigrams(text: string): string[] {
    const clean = normalize(text).replace(/\s/g, "");
    const result: string[] = [];
    for (let i = 0; i < clean.length - 1; i++) {
        result.push(clean.substring(i, i + 2));
    }
    return result;
}

/** 0 = tidak mirip sama sekali, 1 = identik */
export function similarity(a: string, b: string): number {
    if (!a || !b) return 0;

    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 1;

    const bigramsA = bigrams(a);
    const bigramsB = bigrams(b);
    if (bigramsA.length === 0 || bigramsB.length === 0) return 0;

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

    return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

export interface FuzzyCandidate<T> {
    item: T;
    label: string;
}

export interface FuzzyMatchResult<T> {
    item: T;
    label: string;
    score: number;
}

/**
 * Cari kandidat dengan skor kemiripan tertinggi terhadap `query`.
 * Return null jika tidak ada kandidat, atau skor tertinggi < threshold.
 */
export function findBestMatch<T>(
    query: string | null | undefined,
    candidates: FuzzyCandidate<T>[],
    threshold: number = 0.35
): FuzzyMatchResult<T> | null {
    if (!query || !query.trim() || candidates.length === 0) return null;

    let best: FuzzyMatchResult<T> | null = null;
    for (const candidate of candidates) {
        const score = similarity(query, candidate.label);
        if (!best || score > best.score) {
            best = { item: candidate.item, label: candidate.label, score };
        }
    }

    if (!best || best.score < threshold) return null;
    return best;
}