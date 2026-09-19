import { appendFileSync, writeFileSync } from "fs";
import * as p from "path";
import { get_video_metadata, debug_log, debug_error } from "./util";

const M3U8_HEADER: string[] = [
  "#EXTM3U",
  "#EXT-X-PLAYLIST-TYPE:EVENT",
  "#EXT-X-VERSION:7",
  "#EXT-X-MEDIA-SEQUENCE:0",
  "#EXT-X-TARGETDURATION:1",
  "#EXT-X-DISCONTINUITY-SEQUENCE:0",
];

// Create M3U8 playlist file for user streaming
export function create_user_m3u8(id: string, user_path: string): string {
  const stream_file_ending = "_stream_file";
  const stream_file_path = p.join(user_path, id + stream_file_ending + ".m3u8");

  writeFileSync(stream_file_path, M3U8_HEADER.join("\n") + "\n", { flag: "w" });

  // Return URL path with forward slashes
  return `${id}/${id}${stream_file_ending}.m3u8`;
}

// Extract video duration in seconds from video ID
export function extractDurationInSec(video_id: string): number {
  const videoMetadata = get_video_metadata(video_id);

  if (!videoMetadata) {
    return -1;
  }

  return videoMetadata.tsFiles.length;
}

// Add video segment entry to M3U8 playlist
export function add_segment(id: string, segment: string, length: number) {
  const base_path = "users";
  const stream_file_ending = "_stream_file";
  const m3u8_path = p.join(base_path, id, id + stream_file_ending + ".m3u8");

  const newLine = [`#EXTINF:${length},`, segment];
  appendFileSync(m3u8_path, newLine.join("\n") + "\n");
}

// Add stream ending marker to M3U8 playlist
export function addStreamEnding(user_id: string) {
  const base_path = "users";
  const stream_file_ending = "_stream_file";
  const m3u8_path = p.join(
    base_path,
    user_id,
    user_id + stream_file_ending + ".m3u8",
  );
  const newLine = [`#EXT-X-ENDLIST`];
  appendFileSync(m3u8_path, newLine.join("\n") + "\n");
}

// Add discontinuity marker to M3U8 playlist for stream transitions
export function addDiscontinuity(user_id: string) {
  const base_path = "users";
  const stream_file_ending = "_stream_file";
  const m3u8_path = p.join(
    base_path,
    user_id,
    user_id + stream_file_ending + ".m3u8",
  );
  const newLine = [`#EXT-X-DISCONTINUITY`];
  appendFileSync(m3u8_path, newLine.join("\n") + "\n");
}

// Find and return URL path for next video segment
export function find_next_segment_path(
  video_id: string,
  new_segment: number,
  user_id: string,
): string {
  const videoMetadata = get_video_metadata(video_id);

  if (!videoMetadata) {
    return "";
  }

  if (new_segment >= videoMetadata.tsFiles.length) return "ENDING";

  debug_log("found ts FILE", videoMetadata.tsFiles[new_segment], new_segment);

  // Use relative URL path so it works behind any reverse proxy / CDN tunnel
  const urlPath = `${video_id}/${user_id}/${videoMetadata.tsFiles[new_segment]}`;

  return `/${urlPath}`;
}

// Extract segment number from TS filename
export function extract_ts_segment_number(filename: string): number {
  if (!filename.includes("ts")) {
    debug_error(
      `CRITICAL: Could not extract ts Segment Number from ${filename}`,
    );
    return -1;
  }

  const segment_number_regex = /(.+)__(\d+)\.ts/;
  const match = filename.match(segment_number_regex);

  if (!match) {
    debug_error(`CRITICAL: Could not find segment number in ${filename}`);
    return -1;
  }

  const segment_number = match[2];
  return Number(segment_number);
}
