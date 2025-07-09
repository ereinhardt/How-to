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

const M3U8_HEADER: string[] = [
  "#EXTM3U",
  "#EXT-X-PLAYLIST-TYPE: EVENT",
  "#EXT-X-INDEPENDET-SEGMENTS",
  "#EXT-X-VERSION: 4",
];

export function create_user_m3u8(id: string, user_path: string): string {
  const stream_file_ending = save_accesing_env_field("USER_STREAM_FILE_ENDING");
  const stream_file_path = p.join(user_path, id + stream_file_ending + ".m3u8");

  console.log(stream_file_path);
  writeFileSync(stream_file_path, M3U8_HEADER.join("\n") + "\n", { flag: "w" });

  return stream_file_path;
}

export function add_segment(id: string, segment: string, length: number) {
  const base_path = save_accesing_env_field("USERS_FOLDER");
  const stream_file_ending = save_accesing_env_field("USER_STREAM_FILE_ENDING");
  const m3u8_path = p.join(base_path, id, id + stream_file_ending + ".m3u8");

  const newLine = [`#EXTINF:${length}`, segment];
  appendFileSync(m3u8_path, newLine.join("\n") + "\n");
}

export function find_next_segment_path(
  video_id: string,
  new_segment: number
): string {
  const video_path = save_accesing_env_field("VIDEOS_PATH");

  const dir = readdirSync(video_path);

  let current_video_id = "";
  let current_video_path = "";

  for (const video of dir) {
    const id_regex = /([^.]+\?)_([^.]+)/;

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
    "ts_stream_convert"
  );

  const video_stream_files = readdirSync(video_id_path);

  const video_segment_files = video_stream_files.filter((f) =>
    f.includes(".ts")
  );

  if (new_segment > video_segment_files.length) return "";

  return p.join(video_id_path, video_segment_files[new_segment]);
}
