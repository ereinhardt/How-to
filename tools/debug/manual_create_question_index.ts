import {
  existsSync,
  readdirSync,
  writeFileSync,
  lstatSync,
  mkdirSync,
} from "fs";
import { copyFile, rename } from "fs/promises";
import { exec } from "child_process";

import * as p from "path";
import { argv, stdin, stdout } from "process";

/**
 * A standalone script to generate a `question_index.csv` file.
 * It reads all video filenames from a specified directory, extracts
 * the video title and ID from each filename, and writes them to a CSV file.
 *
 * Usage:
 * ts-node manual_create_question_index.ts dir=<directory_path>
 */
// Generate CSV question index from video filenames in directory
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
      "Usage: ts-node manual_create_question_index.ts dir=<directory_path>"
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

  const id_regex = /^(.*?)_(.*)/;

  try {
    const files = readdirSync(basePath);
    let csvContent = csv_header;

    console.log(`Scanning directory: ${basePath}`);

    for (const videoFileName of files) {
      const parsed_file_name = videoFileName.match(id_regex);

      if (parsed_file_name && parsed_file_name.length === 3) {
        const video_name = parsed_file_name[1];
        const video_id = parsed_file_name[2];

        console.log(`Found video: ID=${video_id}, Name=${video_name}`);

        const row = `"${video_name}";"${video_id}"\n`;
        csvContent += row;
      }
    }

    writeFileSync(file_path, csvContent, { encoding: "utf-8" });
    console.log(`Successfully created and wrote to ${file_path}`);
  } catch (error) {
    console.error("An error occurred during file processing:");
    console.error(error);
  }
}

// Execute the main function
createQuestionIndex();
