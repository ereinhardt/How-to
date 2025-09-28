import {
  appendFileSync,
  lstat,
  lstatSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "fs";
import * as p from "path";
import { save_accesing_env_field } from "./util";
import assert from "assert";

const M3U8_HEADER: string[] = [
  "#EXTM3U",
  "#EXT-X-PLAYLIST-TYPE:EVENT",
  "#EXT-X-VERSION:7>",
  "#EXT-X-MEDIA-SEQUENCE:0",
  "#EXT-X-TARGETDURATION:1",
  "#EXT-X-DISCONTINUITY-SEQUENCE:0",
];

function sortFilePathsByNumber(paths: string[]): string[] {
  return paths.sort((a, b) => {
    const numA = extract_ts_segment_number(a);
    const numB = extract_ts_segment_number(b);
    return numA - numB;
  });
}

export function create_user_m3u8(id: string, user_path: string): string {
  const stream_file_ending = save_accesing_env_field("USER_STREAM_FILE_ENDING");
  const stream_file_path = p.join(user_path, id + stream_file_ending + ".m3u8");

  writeFileSync(stream_file_path, M3U8_HEADER.join("\n") + "\n", { flag: "w" });

  return p.join(id, id + stream_file_ending + ".m3u8");
}

export function extractDurationInSec(video_id: string): number {
  const video_path = save_accesing_env_field("VIDEOS_PATH");

  const dir = readdirSync(video_path);

  let current_video_id = "";
  let current_video_path = "";

  for (const video of dir) {
    if (!lstatSync(p.join(video_path, video)).isDirectory()) continue;

    const id_regex = /([^.]+)_([^.]+)/;
    const parsed_video_title = video.match(id_regex);

    if (parsed_video_title == null) continue;

    current_video_id = parsed_video_title[2];
    current_video_path = video;

    if (current_video_id == video_id) {
      break;
    }
  }

  if (!current_video_id) {
    return -1;
  }

  const video_id_path = p.join(
    video_path,
    current_video_path,
    save_accesing_env_field("VIDEO_TS_FOLDER_NAME")
  );

  const video_stream_files = readdirSync(video_id_path);

  const video_segment_files = sortFilePathsByNumber(
    video_stream_files.filter((f) => f.includes(".ts"))
  );

  return video_segment_files.length;
}

export function add_segment(id: string, segment: string, length: number) {
  const base_path = save_accesing_env_field("USERS_FOLDER");
  const stream_file_ending = save_accesing_env_field("USER_STREAM_FILE_ENDING");
  const m3u8_path = p.join(base_path, id, id + stream_file_ending + ".m3u8");

  const newLine = [`#EXTINF:${length}`, segment];
  appendFileSync(m3u8_path, newLine.join("\n") + "\n");
}

export function addStreamEnding(user_id: string) {
  const base_path = save_accesing_env_field("USERS_FOLDER");
  const stream_file_ending = save_accesing_env_field("USER_STREAM_FILE_ENDING");
  const m3u8_path = p.join(
    base_path,
    user_id,
    user_id + stream_file_ending + ".m3u8"
  );
  const newLine = [`#EXT-X-ENDLIST`];
  appendFileSync(m3u8_path, newLine.join("\n") + "\n");
}

export function addDiscontinuity(user_id: string) {
  const base_path = save_accesing_env_field("USERS_FOLDER");
  const stream_file_ending = save_accesing_env_field("USER_STREAM_FILE_ENDING");
  const m3u8_path = p.join(
    base_path,
    user_id,
    user_id + stream_file_ending + ".m3u8"
  );
  const newLine = [`#EXT-X-DISCONTINUITY`];
  appendFileSync(m3u8_path, newLine.join("\n") + "\n");
}

export function find_next_segment_path(
  video_id: string,
  new_segment: number,
  user_id: string
): string {
  const video_path = save_accesing_env_field("VIDEOS_PATH");

  const dir = readdirSync(video_path);

  let current_video_id = "";
  let current_video_path = "";

  for (const video of dir) {
    if (!lstatSync(p.join(video_path, video)).isDirectory()) continue;

    const id_regex = /([^.]+)_([^.]+)/;
    const parsed_video_title = video.match(id_regex);

    if (parsed_video_title == null) continue;

    current_video_id = parsed_video_title[2];
    current_video_path = video;

    if (current_video_id == video_id) {
      break;
    }
  }

  if (!current_video_id) {
    return "";
  }

  const video_id_path = p.join(
    video_path,
    current_video_path,
    save_accesing_env_field("VIDEO_TS_FOLDER_NAME")
  );

  const video_stream_files = readdirSync(video_id_path);

  const video_segment_files = sortFilePathsByNumber(
    video_stream_files.filter((f) => f.includes(".ts"))
  );

  if (new_segment >= video_segment_files.length) return "ENDING";

  const host = save_accesing_env_field("SERVER_HOST");
  const port = save_accesing_env_field("SERVER_PORT");

  console.log("found ts FILE", video_segment_files[new_segment], new_segment);

  //video_id/user_id/fileName.ts
  return (
    `http://${host}:${port}/` +
    p.join(current_video_id, user_id, video_segment_files[new_segment])
  );
}

export function extract_ts_segment_number(filename: string): number {
  assert(filename.includes("ts"), "could not extract ts Segment Number");

  const segment_number_regex = /(.+)__(\d+)\.ts/;

  const match = filename.match(segment_number_regex);

  assert(match, "could not found a segment number");
  const segment_number = match![2];

  return Number(segment_number);
}
