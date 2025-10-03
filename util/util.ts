import { assert } from "console";
import { lstatSync, readdirSync } from "fs";
import * as p from "path";

export function parse_ai_response(json_markdown_string: string) {
  const match = json_markdown_string.match(/\[[\s\S]*]/gm);

  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    return parsed;
  } catch (e) {
    return null;
  }
}

export function check_if_ids_exists(response_json: any, csv: string): boolean {
  var i = 1;
  const usedVideoIds = new Set<string>(); // Track used video IDs

  for (const q of response_json) {
    const video_id = q[`video_id_${i}`];
    
    // Check if video has an ID (not empty, null, or undefined)
    if (!video_id || video_id.trim() === "") {
      console.log(`Video ${i} has no ID or empty ID`);
      return false;
    }
    
    // Check if this video ID was already used
    if (usedVideoIds.has(video_id)) {
      console.log(`Video ID ${video_id} is used more than once in the list`);
      return false;
    }
    
    // Check if the ID exists in the CSV
    if (!csv.includes(video_id)) {
      console.log(`Video ID ${video_id} not found in CSV`);
      return false;
    }
    
    // Add video ID to the set of used IDs
    usedVideoIds.add(video_id);
    i++;
  }
  return true;
}

export function save_accesing_env_field(field: string) {
  if (process.env[field]) return process.env[field]!;

  throw Error(`could not found ${field} in .env file!`);
}

export function check_if_user_exits(id: string): boolean {
  const user_path = save_accesing_env_field("USERS_FOLDER");
  const requested_path = p.join(user_path, id);

  return lstatSync(requested_path).isDirectory();
}

export function get_ts_file_by_video_id(video_id: string, segment: number): string | null {
  try {
    const videos_path = save_accesing_env_field("VIDEOS_PATH");

    if (!lstatSync(videos_path).isDirectory()) {
      console.error(`CRITICAL: Video Path ${videos_path} is not a Directory!`);
      return null;
    }

    const videos = readdirSync(videos_path);
    const video = videos.find((v) => v.includes(video_id));

    if (!video) {
      console.error(`CRITICAL: Could not find a video with id: ${video_id}`);
      return null;
    }

    const video_path = p.join(
      videos_path,
      video,
      save_accesing_env_field("VIDEO_TS_FOLDER_NAME")
    );

    if (!lstatSync(video_path).isDirectory()) {
      console.error(`CRITICAL: Video path ${video_path} is not a Directory!`);
      return null;
    }

    const ts_files = readdirSync(video_path);
    const ts_file = ts_files.find((t) => t.match(`__${segment}.ts`));

    if (!ts_file) {
      console.error(`CRITICAL: Could not find ts File for segment ${segment}`);
      return null;
    }

    return p.join(video_path, ts_file);
  } catch (error: any) {
    console.error(`CRITICAL ERROR in get_ts_file_by_video_id:`, error.message);
    return null;
  }
}
