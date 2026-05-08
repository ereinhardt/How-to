import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  lstatSync,
} from "fs";

import * as p from "path";
import { argv } from "process";

/**
 * A standalone script to generate a `question_index.csv` file.
 * It reads all video folders from a specified directory, validates
 * each folder's structure (mp4 file, ts_stream_convert dir, m3u8 playlist,
 * .ts segments), and writes valid entries to a CSV file.
 *
 * Usage:
 * ts-node manual_create_question_index.ts dir=<directory_path>
 */

const ID_REGEX = /^(.*?)_(.*)/;

// Validate that a video folder has the expected structure
function validateVideoFolder(
  basePath: string,
  folderName: string,
): string | null {
  const folderPath = p.join(basePath, folderName);

  // 1. Folder name must match <title>_<videoId> pattern
  const parsed = folderName.match(ID_REGEX);
  if (!parsed || parsed.length !== 3) {
    return `folder name does not match <title>_<videoId> pattern`;
  }

  // 2. Must actually be a directory
  try {
    if (!lstatSync(folderPath).isDirectory()) {
      return `not a directory`;
    }
  } catch {
    return `cannot stat folder`;
  }

  const contents = readdirSync(folderPath);

  // 3. Must contain an .mp4 file named <folderName>.mp4
  const expectedMp4 = folderName + ".mp4";
  if (!contents.includes(expectedMp4)) {
    return `missing expected mp4 file: ${expectedMp4}`;
  }

  // 4. Must contain ts_stream_convert directory
  const tsDir = "ts_stream_convert";
  const tsDirPath = p.join(folderPath, tsDir);
  if (!contents.includes(tsDir)) {
    return `missing ts_stream_convert directory`;
  }
  try {
    if (!lstatSync(tsDirPath).isDirectory()) {
      return `ts_stream_convert is not a directory`;
    }
  } catch {
    return `cannot stat ts_stream_convert`;
  }

  const tsContents = readdirSync(tsDirPath);

  // 5. Must contain m3u8 playlist file: <folderName>_playlist.m3u8
  const expectedPlaylist = folderName + "_playlist.m3u8";
  if (!tsContents.includes(expectedPlaylist)) {
    return `missing playlist file: ${expectedPlaylist}`;
  }

  // 6. Must contain at least one .ts segment file
  const tsSegments = tsContents.filter((f) => f.endsWith(".ts"));
  if (tsSegments.length === 0) {
    return `ts_stream_convert contains no .ts segment files`;
  }

  // 7. Number of .ts files must match number of segments in playlist
  const playlistContent = readFileSync(
    p.join(tsDirPath, expectedPlaylist),
    "utf-8",
  );
  const playlistSegmentCount = playlistContent
    .split(/\r?\n/)
    .filter((line) => line.endsWith(".ts")).length;

  if (tsSegments.length !== playlistSegmentCount) {
    return `.ts file count (${tsSegments.length}) does not match playlist segment count (${playlistSegmentCount})`;
  }

  return null; // validation passed
}

// Generate CSV question index from validated video folders
function createQuestionIndex() {
  const args = argv;
  let basePath: string | undefined;

  for (const arg of args) {
    if (arg.startsWith("dir=")) {
      basePath = arg.split("=")[1];
      break;
    }
  }

  if (!basePath) {
    console.error("Error: Missing required argument 'dir'.");
    console.error(
      "Usage: ts-node manual_create_question_index.ts dir=<directory_path>",
    );
    return;
  }

  if (!existsSync(basePath)) {
    console.error(`Error: The directory '${basePath}' does not exist.`);
    return;
  }

  const file_name = "question_index.csv";
  const csv_header = '"video_title";"video_id"\n';
  const file_path = p.join(basePath, file_name);

  try {
    const entries = readdirSync(basePath);
    const validRows: { video_name: string; video_id: string }[] = [];
    let skippedCount = 0;

    console.log(`Scanning directory: ${basePath}`);

    for (const entry of entries) {
      // Skip non-directories
      const entryPath = p.join(basePath, entry);
      try {
        if (!lstatSync(entryPath).isDirectory()) continue;
      } catch {
        continue;
      }

      const validationError = validateVideoFolder(basePath, entry);

      if (validationError) {
        console.warn(`SKIPPED "${entry}": ${validationError}`);
        skippedCount++;
        continue;
      }

      const parsed = entry.match(ID_REGEX)!;
      const video_name = parsed[1];
      const video_id = parsed[2];

      console.log(`VALID   "${entry}": ID=${video_id}, Name=${video_name}`);
      validRows.push({ video_name, video_id });
    }

    // Shuffle rows randomly (Fisher-Yates)
    for (let i = validRows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [validRows[i], validRows[j]] = [validRows[j], validRows[i]];
    }

    let csvContent = csv_header;
    for (const { video_name, video_id } of validRows) {
      csvContent += `"${video_name}";"${video_id}"\n`;
    }

    writeFileSync(file_path, csvContent, { encoding: "utf-8" });
    console.log(`\nDone. Valid: ${validRows.length}, Skipped: ${skippedCount}`);
    console.log(`Written to ${file_path}`);
  } catch (error) {
    console.error("An error occurred during file processing:");
    console.error(error);
  }
}

// Execute the main function
createQuestionIndex();
