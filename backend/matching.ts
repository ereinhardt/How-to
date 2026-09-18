import * as p from "path";
import { existsSync, readFileSync } from "fs";
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";
import { save_accesing_env_field, debug_log } from "./util";

const MODEL_ID = "embeddinggemma-300m";
const MODELS_DIR = p.resolve(process.cwd(), "models");
const EMBEDDING_BATCH_SIZE = 32;
const MAX_QUESTION_LENGTH = 512;

// fp32 weights live in the separate .onnx_data file, the .onnx holds only the graph
const MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/model.onnx",
  "onnx/model.onnx_data",
];

// EmbeddingGemma was trained with these task prefixes, retrieval quality drops without them
const DOCUMENT_PREFIX = "title: none | text: ";
const QUERY_PREFIX = "task: search result | query: ";

env.allowRemoteModels = false;
env.localModelPath = MODELS_DIR;

interface PlaylistIndexEntry {
  initial_question: string;
  playlist: any[];
}

let extractor: FeatureExtractionPipeline | null = null;
let entries: PlaylistIndexEntry[] = [];
let embeddings = new Float32Array(0);
let embeddingDimension = 0;

function loadPlaylistIndex(): PlaylistIndexEntry[] {
  const playlistIndexPath = p.resolve(
    save_accesing_env_field("PLAYLIST_INDEX_PATH"),
  );

  const parsed = JSON.parse(
    readFileSync(playlistIndexPath, { encoding: "utf8" }),
  );

  if (!Array.isArray(parsed)) {
    throw new Error("PLAYLIST_INDEX_INVALID");
  }

  return parsed.filter(
    (entry: PlaylistIndexEntry) =>
      entry &&
      typeof entry.initial_question === "string" &&
      entry.initial_question.trim().length > 0 &&
      Array.isArray(entry.playlist) &&
      entry.playlist.length > 0,
  );
}

async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (!extractor) throw new Error("EMBEDDING_MODEL_NOT_LOADED");

  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const [count, dimension] = output.dims;
  const data = output.data as Float32Array;

  const vectors: Float32Array[] = [];
  for (let i = 0; i < count; i++) {
    vectors.push(data.slice(i * dimension, (i + 1) * dimension));
  }

  return vectors;
}

function sanitizeQuestion(question: string): string {
  return question
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUESTION_LENGTH);
}

function assertModelFilesExist(modelPath: string): void {
  const missing = MODEL_FILES.filter(
    (file) => !existsSync(p.join(modelPath, file)),
  );

  if (missing.length === 0) return;

  throw new Error(
    `embedding model incomplete in ${modelPath}, missing: ${missing.join(", ")}. ` +
      `Run "python tools/model-downloader.py" to fetch it.`,
  );
}

// Load the embedding model and embed every initial_question of the playlist index
export async function initQuestionMatching(): Promise<void> {
  const modelPath = p.join(MODELS_DIR, MODEL_ID);

  assertModelFilesExist(modelPath);

  entries = loadPlaylistIndex();

  if (entries.length === 0) {
    throw new Error("PLAYLIST_INDEX_EMPTY");
  }

  debug_log(`loading embedding model from ${modelPath} ...`);
  extractor = await pipeline("feature-extraction", MODEL_ID, {
    dtype: "fp32",
  });

  debug_log(`embedding ${entries.length} questions ...`);
  const startedAt = Date.now();
  const vectors: Float32Array[] = [];

  for (let i = 0; i < entries.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = entries
      .slice(i, i + EMBEDDING_BATCH_SIZE)
      .map((entry) => DOCUMENT_PREFIX + entry.initial_question);

    for (const vector of await embedBatch(batch)) {
      vectors.push(vector);
    }

    debug_log(`embedded ${vectors.length}/${entries.length} questions`);
  }

  embeddingDimension = vectors[0].length;
  embeddings = new Float32Array(vectors.length * embeddingDimension);
  vectors.forEach((vector, i) => embeddings.set(vector, i * embeddingDimension));

  debug_log(
    `embedded ${entries.length} questions in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );
}

// Find the playlist whose initial question is semantically closest to the user input
export default async function generate_question(
  start_question: string,
): Promise<any> {
  if (!extractor || embeddingDimension === 0) {
    throw new Error("MATCHING_NOT_INITIALIZED");
  }

  const question = sanitizeQuestion(start_question);

  if (question.length === 0) {
    throw new Error("EMPTY_QUESTION");
  }

  const [queryVector] = await embedBatch([QUERY_PREFIX + question]);

  let bestIndex = 0;
  let bestScore = -Infinity;

  // Vectors are normalized, so the dot product is the cosine similarity
  for (let i = 0; i < entries.length; i++) {
    const offset = i * embeddingDimension;
    let score = 0;

    for (let j = 0; j < embeddingDimension; j++) {
      score += queryVector[j] * embeddings[offset + j];
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const bestEntry = entries[bestIndex];

  debug_log(
    `Matched "${question}" to "${bestEntry.initial_question}" (score ${bestScore.toFixed(3)})`,
  );

  return bestEntry.playlist;
}

