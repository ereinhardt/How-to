import * as p from "path";
import { readFileSync } from "fs";
import { save_accesing_env_field, debug_log } from "./util";

interface PlaylistIndexEntry {
  initial_question: string;
  playlist: any[];
}

let cachedPlaylistIndexPath = "";
let cachedPlaylistIndex: PlaylistIndexEntry[] = [];

function getPlaylistIndex(): PlaylistIndexEntry[] {
  const playlistIndexPath = p.resolve(
    save_accesing_env_field("PLAYLIST_INDEX_PATH"),
  );

  if (
    cachedPlaylistIndexPath !== playlistIndexPath ||
    cachedPlaylistIndex.length === 0
  ) {
    const parsed = JSON.parse(
      readFileSync(playlistIndexPath, { encoding: "utf8" }),
    );

    if (!Array.isArray(parsed)) {
      throw new Error("PLAYLIST_INDEX_INVALID");
    }

    cachedPlaylistIndexPath = playlistIndexPath;
    cachedPlaylistIndex = parsed;
  }

  return cachedPlaylistIndex;
}

export function warmupPlaylistIndexCache(): void {
  getPlaylistIndex();
}

// Lowercase, drop punctuation and every leading "how to" so questions are comparable
function normalize(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(?:\s*how\s+to\s+)+/, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  const currentRow = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    currentRow[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

      currentRow[j] = Math.min(
        currentRow[j - 1] + 1,
        previousRow[j] + 1,
        previousRow[j - 1] + substitutionCost,
      );
    }

    previousRow = [...currentRow];
  }

  return previousRow[b.length];
}

function levenshteinSimilarity(a: string, b: string): number {
  const longestLength = Math.max(a.length, b.length);

  if (longestLength === 0) return 1;

  return 1 - levenshteinDistance(a, b) / longestLength;
}

function wordOverlapSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter((w) => w.length > 0));
  const wordsB = new Set(b.split(" ").filter((w) => w.length > 0));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared++;
  }

  return shared / (wordsA.size + wordsB.size - shared);
}

// Combined score of shared words and character similarity
function similarity(a: string, b: string): number {
  return 0.7 * wordOverlapSimilarity(a, b) + 0.3 * levenshteinSimilarity(a, b);
}

// Find the playlist of the most similar initial question in the playlist index
export default async function generate_question(
  start_question: string,
): Promise<any> {
  start_question = start_question.replace(/[^A-Za-z0-9 _-]/g, "");

  const playlistIndex = getPlaylistIndex();

  if (playlistIndex.length === 0) {
    debug_log("playlist index is empty");
    throw new Error("PLAYLIST_INDEX_ERROR");
  }

  const normalizedSearch = normalize(start_question);

  let bestEntry: PlaylistIndexEntry | null = null;
  let bestScore = -1;

  for (const entry of playlistIndex) {
    if (!entry || !Array.isArray(entry.playlist) || entry.playlist.length === 0)
      continue;

    const score = similarity(
      normalizedSearch,
      normalize(entry.initial_question ?? ""),
    );

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (!bestEntry) {
    debug_log("no usable playlist found in playlist index");
    throw new Error("PLAYLIST_INDEX_ERROR");
  }

  debug_log(
    `Matched "${start_question}" to "${bestEntry.initial_question}" (score ${bestScore.toFixed(3)})`,
  );

  return bestEntry.playlist;
}
