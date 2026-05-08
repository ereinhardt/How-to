import { lstatSync, readFileSync, readdirSync } from "fs";
import * as p from "path";
import { networkInterfaces } from "os";

export interface VideoMetadata {
  folderName: string;
  tsFolderPath: string;
  tsFiles: string[];
  segmentDurations: number[];
}

let cachedVideosPath: string | null = null;
let cachedVideoMetadata = new Map<string, VideoMetadata>();

function extractSegmentNumberForSort(filename: string): number {
  const match = filename.match(/(.+)__(\d+)\.ts/);

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(match[2]);
}

function sortTsFiles(files: string[]): string[] {
  return [...files].sort((a, b) => {
    return extractSegmentNumberForSort(a) - extractSegmentNumberForSort(b);
  });
}

function parsePlaylistDurations(tsFolderPath: string): number[] {
  const playlistFiles = readdirSync(tsFolderPath).filter((f) =>
    f.endsWith("_playlist.m3u8"),
  );

  if (playlistFiles.length === 0) return [];

  const content = readFileSync(p.join(tsFolderPath, playlistFiles[0]), "utf-8");
  const durations: number[] = [];

  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^#EXTINF:([\d.]+)/);
    if (match) {
      durations.push(parseFloat(match[1]));
    }
  }

  return durations;
}

function buildVideoMetadataIndex(
  videosPath: string,
): Map<string, VideoMetadata> {
  const videoTsFolderName = "ts_stream_convert";
  const videoIndex = new Map<string, VideoMetadata>();

  for (const video of readdirSync(videosPath)) {
    const videoFolderPath = p.join(videosPath, video);

    if (!lstatSync(videoFolderPath).isDirectory()) {
      continue;
    }

    const parsedVideoTitle = video.match(/^([^_]+)_(.+)$/);

    if (!parsedVideoTitle) {
      continue;
    }

    const videoId = parsedVideoTitle[2];
    const tsFolderPath = p.join(videoFolderPath, videoTsFolderName);

    if (!lstatSync(tsFolderPath).isDirectory()) {
      continue;
    }

    const tsFiles = sortTsFiles(
      readdirSync(tsFolderPath).filter((file) => file.endsWith(".ts")),
    );

    const segmentDurations = parsePlaylistDurations(tsFolderPath);

    videoIndex.set(videoId, {
      folderName: video,
      tsFolderPath,
      tsFiles,
      segmentDurations,
    });
  }

  return videoIndex;
}

function getVideoMetadataIndex(
  forceRefresh: boolean = false,
): Map<string, VideoMetadata> {
  const videosPath = save_accesing_env_field("VIDEOS_PATH");

  if (
    forceRefresh ||
    cachedVideosPath !== videosPath ||
    cachedVideoMetadata.size === 0
  ) {
    cachedVideosPath = videosPath;
    cachedVideoMetadata = buildVideoMetadataIndex(videosPath);
  }

  return cachedVideoMetadata;
}

export function warmupVideoMetadataCache(): void {
  getVideoMetadataIndex(true);
}

// Get the actual duration for a specific segment of a video
export function getSegmentDuration(video_id: string, segment: number): number {
  const metadata = get_video_metadata(video_id);
  if (metadata && segment < metadata.segmentDurations.length) {
    return metadata.segmentDurations[segment];
  }
  return 1.0;
}

// Parse JSON response from AI markdown string
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

// Validate video IDs exist and are unique in CSV data
export function check_if_ids_exists(response_json: any, csv: string): boolean {
  var i = 1;
  const usedVideoIds = new Set<string>();

  for (const q of response_json) {
    const video_id = q[`video_id_${i}`];
    const video_title = q[`video_title_${i}`];

    // Check if video has an ID (not empty, null, or undefined)
    if (!video_id || video_id.trim() === "") {
      debug_log(`Video ${i} has no ID or empty ID`);
      return false;
    }

    // Check if video has a title (not empty, null, or undefined)
    if (!video_title || video_title.trim() === "") {
      debug_log(`Video ${i} has no title or empty title`);
      return false;
    }

    // Check if this video ID was already used
    if (usedVideoIds.has(video_id)) {
      debug_log(`Video ID ${video_id} is used more than once in the list`);
      return false;
    }

    // Check if the ID exists in the CSV
    if (!csv.includes(video_id)) {
      debug_log(`Video ID ${video_id} not found in CSV`);
      return false;
    }

    // Add video ID to the set of used IDs
    usedVideoIds.add(video_id);
    i++;
  }
  return true;
}

// Get local network IP address for server binding
export function getLocalNetworkIP(): string {
  try {
    const interfaces = networkInterfaces();

    const preferredInterfaces = ["en0", "eth0", "wlan0", "Wi-Fi", "Ethernet"];

    for (const interfaceName of preferredInterfaces) {
      const networkInterface = interfaces[interfaceName];
      if (networkInterface) {
        for (const net of networkInterface) {
          if (
            net.family === "IPv4" &&
            !net.internal &&
            net.address !== "127.0.0.1"
          ) {
            return net.address;
          }
        }
      }
    }

    for (const interfaceName in interfaces) {
      const networkInterface = interfaces[interfaceName];
      if (networkInterface) {
        for (const net of networkInterface) {
          if (
            net.family === "IPv4" &&
            !net.internal &&
            net.address !== "127.0.0.1"
          ) {
            return net.address;
          }
        }
      }
    }

    return "localhost";
  } catch (error) {
    return "localhost";
  }
}

// Access environment variable with IP detection for SERVER_HOST
export function save_accesing_env_field_with_ip_detection(
  field: string,
): string {
  if (field === "SERVER_HOST") {
    const localhostFlag = process.env.LOCALHOST;

    if (localhostFlag === "1") {
      return "localhost";
    } else {
      const detectedIP = getLocalNetworkIP();
      return detectedIP;
    }
  }

  if (process.env[field]) return process.env[field]!;

  throw Error(`could not found ${field} in .env file!`);
}

// Access environment variable or throw error if not found
export function save_accesing_env_field(field: string) {
  if (process.env[field]) return process.env[field]!;

  throw Error(`could not found ${field} in .env file!`);
}

function timestamp(): string {
  return `[${new Date().toISOString().replace("T", " ").slice(0, 23)}]`;
}

// Debug logging - only logs when SERVER_DEBUG=1
export function debug_log(...args: any[]): void {
  if (process.env.SERVER_DEBUG === "1") {
    console.log(timestamp(), ...args);
  }
}

export function debug_error(...args: any[]): void {
  if (process.env.SERVER_DEBUG === "1") {
    console.error(timestamp(), ...args);
  }
}

// Check if user directory exists
export function check_if_user_exits(id: string): boolean {
  const user_path = "users";
  const requested_path = p.join(user_path, id);

  try {
    return lstatSync(requested_path).isDirectory();
  } catch {
    return false;
  }
}

export function get_video_metadata(video_id: string): VideoMetadata | null {
  let videoMetadata = getVideoMetadataIndex().get(video_id);

  if (videoMetadata) {
    return videoMetadata;
  }

  videoMetadata = getVideoMetadataIndex(true).get(video_id);
  return videoMetadata ?? null;
}

// Get TS video file path by video ID and segment number
export function get_ts_file_by_video_id(
  video_id: string,
  segment: number,
): string | null {
  try {
    const videoMetadata = get_video_metadata(video_id);

    if (!videoMetadata) {
      debug_error(`CRITICAL: Could not find a video with id: ${video_id}`);
      return null;
    }

    const ts_file = videoMetadata.tsFiles.find((file) =>
      file.endsWith(`__${segment}.ts`),
    );

    if (!ts_file) {
      debug_error(`CRITICAL: Could not find ts File for segment ${segment}`);
      return null;
    }

    return p.join(videoMetadata.tsFolderPath, ts_file);
  } catch (error: any) {
    debug_error(`CRITICAL ERROR in get_ts_file_by_video_id:`, error.message);
    return null;
  }
}
