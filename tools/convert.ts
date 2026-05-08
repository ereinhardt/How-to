import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  appendFileSync,
  existsSync,
  writeFileSync,
} from "fs";
import { rename } from "fs/promises";
import { exec } from "child_process";

import * as p from "path";
import { argv } from "process";

interface arg_state {
  dir: string;
}

const OPTS = ["dir"];

// Parse command line arguments into structured state
function parse_args(): arg_state | undefined {
  const args = argv.slice(2);

  const state: arg_state = {
    dir: "",
  };

  if (args.find((arg) => !arg.includes("="))) {
    console.log(
      "could not Parse argument. Arguments should have following Structure: opt=value!",
    );
    return;
  }

  for (const arg of args) {
    const opt = arg.split("=");
    const optName = opt[0];
    const optValue = opt[1];

    if (!OPTS.includes(optName)) {
      console.log("unkown option!");
      return;
    }

    switch (optName) {
      case "dir":
        const path = lstatSync(optValue);

        if (!path.isDirectory()) {
          console.log("dir path is not a Dir!");
          return;
        }

        state.dir = optValue;

        break;

      default:
        throw Error("UNREACHABLE!");
    }
  }

  return state;
}

// Extract file extension from filename
function parse_file_end(fileName: string): string {
  let current_index = fileName.length - 1;
  let current_char = fileName[current_index];
  let file_extension = "";

  while (current_char != "." && current_index >= 0) {
    file_extension = current_char + file_extension;
    current_index--;
    current_char = fileName[current_index];
  }

  if (fileName == file_extension) {
    return "";
  }

  return file_extension;
}

// Check if filename contains ID (has underscore)
function has_id(fileName: string): boolean {
  return fileName.includes("_");
}

// Check if directory doesn't already exist for this filename
function has_not_dir(fileName: string, path: string): boolean {
  const newDirName = remove_question_marks(
    space_to_hyphen(remove_file_extension(fileName)),
  );
  const dirPath = p.join(path, newDirName);
  try {
    return !lstatSync(dirPath).isDirectory();
  } catch {
    return true; // path doesn't exist, so no dir yet
  }
}

// Remove file extension from filename
function remove_file_extension(fileName: string): string {
  const extension = parse_file_end(fileName);

  if (!extension)
    throw Error(
      "attempt to remove file extension for a file without a extension!",
    );

  return fileName.replace("." + extension, "");
}

// Replace spaces with hyphens in string
function space_to_hyphen(str: string): string {
  return str.replace(/\s/g, "-");
}

// Remove question marks from string
function remove_question_marks(str: string): string {
  return str.replace(/[\?\uF025]/g, "");
}

// Check if FFmpeg is installed on the system
async function check_ffmpeg_installation(): Promise<boolean> {
  return new Promise((resolve) => {
    exec("ffmpeg -version", (error) => {
      resolve(!error);
    });
  });
}

// Get video duration in seconds using ffprobe
async function get_video_duration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    exec(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${inputPath}`,
      (e, stdout) => {
        if (e) reject(e);
        else resolve(parseFloat(stdout.trim()));
      },
    );
  });
}

// Convert video file to HLS stream format using FFmpeg
async function convert_to_fs(
  path: string,
  fileName: string,
  input_path: string,
): Promise<void> {
  // Wrap paths in quotes to handle special characters
  const quotedInputPath = `"${input_path}"`;
  const quotedSegmentPath = `"${path}/${fileName}__%d.ts"`;
  const quotedPlaylistPath = `"${path}/${fileName}_playlist.m3u8"`;

  // Pad video to exact whole seconds so every segment is exactly 1s
  const duration = await get_video_duration(quotedInputPath);
  const ceilDuration = Math.ceil(duration);
  // Pad enough to guarantee a full last second (2s extra, then trim)
  const padSeconds = ceilDuration - duration + 2;

  const opts = [
    `-i ${quotedInputPath}`,
    "-c:v libx264",
    "-c:a aac",
    "-profile:v baseline",
    "-level 3.0",
    "-start_number 0",
    "-crf 30",
    `-filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=add:color=black:stop_duration=${padSeconds}[v];[0:a]aresample=44100,apad=whole_dur=${ceilDuration}[a]"`,
    `-map "[v]"`,
    `-map "[a]"`,
    `-t ${ceilDuration}`,
    "-max_interleave_delta 0",
    "-r 25",
    "-g 25",
    `-force_key_frames "expr:gte(t,n_forced*1)"`,
    "-ac 2",
    "-ar 44100",
    "-hls_time 1",
    "-hls_list_size 0",
    "-hls_segment_filename",
    quotedSegmentPath,
    quotedPlaylistPath,
  ];

  return new Promise((resolve, reject) => {
    exec("ffmpeg " + opts.join(" "), { maxBuffer: 1024 * 1024 * 1024 }, (e) => {
      if (!e) {
        resolve();
      } else {
        console.error("FFmpeg conversion error:", e);
        reject(e);
      }
    });
  });
}

// Run ffprobe and return parsed JSON output
async function ffprobe_json(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    exec(
      `ffprobe -v error -show_format -show_streams -of json "${filePath}"`,
      { maxBuffer: 1024 * 1024 * 10 },
      (e, stdout) => {
        if (e) reject(e);
        else {
          try {
            resolve(JSON.parse(stdout.trim()));
          } catch {
            reject(new Error("ffprobe output is not valid JSON"));
          }
        }
      },
    );
  });
}

// Parse m3u8 playlist and return segment entries with expected durations
function parse_m3u8(
  playlistPath: string,
):
  | { segments: { file: string; duration: number }[]; targetDuration: number }
  | string {
  if (!existsSync(playlistPath)) {
    return "playlist file does not exist: " + playlistPath;
  }

  const content = readFileSync(playlistPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (!lines[0]?.startsWith("#EXTM3U")) {
    return "playlist does not start with #EXTM3U header";
  }

  let targetDuration = 0;
  const segments: { file: string; duration: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("#EXT-X-TARGETDURATION:")) {
      targetDuration = parseFloat(line.split(":")[1]);
    }

    if (line.startsWith("#EXTINF:")) {
      const dur = parseFloat(line.replace("#EXTINF:", "").replace(",", ""));
      const nextLine = lines[i + 1];
      if (!nextLine || nextLine.startsWith("#")) {
        return (
          "EXTINF at line " + (i + 1) + " has no segment file following it"
        );
      }
      segments.push({ file: nextLine.trim(), duration: dur });
    }
  }

  if (!lines.find((l) => l.startsWith("#EXT-X-ENDLIST"))) {
    return "playlist is missing #EXT-X-ENDLIST tag (incomplete stream)";
  }

  if (segments.length === 0) {
    return "playlist contains no segments";
  }

  return { segments, targetDuration };
}

// Validate a single .ts segment file
async function validate_segment(
  segmentPath: string,
  expectedDuration: number,
  targetDuration: number,
): Promise<string[]> {
  const errors: string[] = [];
  const segName = p.basename(segmentPath);

  if (!existsSync(segmentPath)) {
    errors.push(`${segName}: file does not exist`);
    return errors;
  }

  let probe: any;
  try {
    probe = await ffprobe_json(segmentPath);
  } catch {
    errors.push(`${segName}: ffprobe failed to read file (possibly corrupt)`);
    return errors;
  }

  const streams: any[] = probe.streams || [];
  const videoStream = streams.find((s: any) => s.codec_type === "video");
  const audioStream = streams.find((s: any) => s.codec_type === "audio");

  // Must have both audio and video
  if (!videoStream) {
    errors.push(`${segName}: missing video stream`);
  }
  if (!audioStream) {
    errors.push(`${segName}: missing audio stream`);
  }

  // Video checks
  if (videoStream) {
    if (videoStream.codec_name !== "h264") {
      errors.push(
        `${segName}: video codec is '${videoStream.codec_name}', expected 'h264'`,
      );
    }

    const width = videoStream.width;
    const height = videoStream.height;
    if (width !== 1920 || height !== 1080) {
      errors.push(
        `${segName}: resolution is ${width}x${height}, expected 1920x1080`,
      );
    }

    // Check profile (baseline for max compatibility)
    const profile = (videoStream.profile || "").toLowerCase();
    if (!profile.includes("baseline")) {
      errors.push(
        `${segName}: video profile is '${videoStream.profile}', expected 'Baseline'`,
      );
    }

    // Check framerate ~25fps
    const fpsStr = videoStream.r_frame_rate || videoStream.avg_frame_rate || "";
    if (fpsStr) {
      const fpsParts = fpsStr.split("/");
      const fps =
        fpsParts.length === 2
          ? parseInt(fpsParts[0]) / parseInt(fpsParts[1])
          : parseFloat(fpsStr);
      if (Math.abs(fps - 25) > 1) {
        errors.push(
          `${segName}: framerate is ${fps.toFixed(2)}fps, expected ~25fps`,
        );
      }
    }
  }

  // Audio checks
  if (audioStream) {
    if (audioStream.codec_name !== "aac") {
      errors.push(
        `${segName}: audio codec is '${audioStream.codec_name}', expected 'aac'`,
      );
    }

    const sampleRate = parseInt(audioStream.sample_rate || "0");
    if (sampleRate !== 44100) {
      errors.push(
        `${segName}: audio sample rate is ${sampleRate}, expected 44100`,
      );
    }

    const channels = audioStream.channels;
    if (channels !== 2) {
      errors.push(
        `${segName}: audio channels is ${channels}, expected 2 (stereo)`,
      );
    }
  }

  // Duration check: segment duration should match playlist EXTINF within tolerance
  const formatDuration = parseFloat(probe.format?.duration || "0");
  if (formatDuration > 0) {
    const diff = Math.abs(formatDuration - expectedDuration);
    // Allow 0.15s tolerance for segment duration vs playlist entry
    if (diff > 0.15) {
      errors.push(
        `${segName}: duration is ${formatDuration.toFixed(3)}s, playlist says ${expectedDuration.toFixed(3)}s (diff ${diff.toFixed(3)}s)`,
      );
    }
    // Segment must not exceed target duration (+ small tolerance)
    if (formatDuration > targetDuration + 0.5) {
      errors.push(
        `${segName}: duration ${formatDuration.toFixed(3)}s exceeds target duration ${targetDuration}s`,
      );
    }
  }

  return errors;
}

// Full HLS validation for a converted video
async function validate_hls(
  tsStreamDir: string,
  fileName: string,
): Promise<string[]> {
  const errors: string[] = [];
  const playlistPath = p.join(tsStreamDir, fileName + "_playlist.m3u8");

  console.log("validating HLS output: " + playlistPath);

  // Parse and validate playlist structure
  const parseResult = parse_m3u8(playlistPath);
  if (typeof parseResult === "string") {
    errors.push("playlist error: " + parseResult);
    return errors;
  }

  const { segments, targetDuration } = parseResult;

  // Check all .ts files in directory are referenced in playlist
  const tsFilesOnDisk = readdirSync(tsStreamDir).filter((f) =>
    f.endsWith(".ts"),
  );
  const playlistFiles = new Set(segments.map((s) => s.file));

  for (const tsFile of tsFilesOnDisk) {
    if (!playlistFiles.has(tsFile)) {
      errors.push(
        `${tsFile}: exists on disk but is not referenced in playlist`,
      );
    }
  }

  // Validate each segment from playlist
  for (const segment of segments) {
    const segPath = p.join(tsStreamDir, segment.file);
    const segErrors = await validate_segment(
      segPath,
      segment.duration,
      targetDuration,
    );
    errors.push(...segErrors);
  }

  return errors;
}

// Write failed video to error log
function write_validation_error_log(
  baseDir: string,
  videoName: string,
  errors: string[],
): void {
  const logPath = p.join(baseDir, "validation_errors.txt");
  const timestamp = new Date().toISOString();
  let content = `\n=== ${videoName} === [${timestamp}]\n`;
  for (const err of errors) {
    content += `  - ${err}\n`;
  }

  if (existsSync(logPath)) {
    appendFileSync(logPath, content, "utf-8");
  } else {
    writeFileSync(logPath, content.trimStart(), "utf-8");
  }

  console.log("validation errors written to: " + logPath);
}

// Main conversion function to process video files
async function convert(): Promise<number> {
  const state = parse_args();
  if (!state) return -1;

  const is_ffmpeg_installed = await check_ffmpeg_installation();

  if (!is_ffmpeg_installed)
    console.log(
      "could not find a ffmpeg installation please look at https://ffmpeg.org!",
    );

  console.log("Start Converting!");

  let dir = readdirSync(state.dir);

  /*
  macOS legt auf nicht-APFS/HFS+-formatierten Laufwerken 
  (wie FAT32, exFAT oder NTFS – z. B. auf USB-Sticks, externen SSDs) 
  sogenannte AppleDouble-Dateien an.
  */
  dir = dir.filter((file) => !file.startsWith("._"));

  for (const video of dir) {
    const file_extension = parse_file_end(video);

    if (file_extension != "mp4") {
      console.log("found a non mp4 file skipped File with path: " + video);
      continue;
    }

    const id = has_id(video);

    if (!id) {
      console.log("could not find a id skipped File with path: " + video);
      continue;
    }

    const not_allready_created_dir = has_not_dir(video, state.dir);

    if (!not_allready_created_dir) {
      console.log(
        "video has allready a folder skipped File with path: " + video,
      );
      continue;
    }

    const newDirName = remove_question_marks(
      space_to_hyphen(remove_file_extension(video)),
    );

    console.log(state.dir);

    const newDirPath = p.join(state.dir, newDirName);
    console.log("made new dir at path: " + newDirPath);

    mkdirSync(newDirPath);

    const old_path = p.join(state.dir, video);
    const new_path = p.join(
      newDirPath,
      remove_question_marks(space_to_hyphen(video)),
    );

    console.log(`start moving file from ${old_path} to ${newDirPath}`);
    await rename(old_path, new_path);

    const new_ts_file_dir = p.join(newDirPath, "ts_stream_convert");

    console.log("created a ts_stream_convert folder for: " + video);
    mkdirSync(new_ts_file_dir);

    console.log(
      "start converting file to m3u8 hls stream! FileName: " + newDirName,
    );
    await convert_to_fs(new_ts_file_dir, newDirName, new_path);
    console.log(
      "sucessfull converting file to m3u8 hls stream! FileName: " + newDirName,
    );

    // Validate the HLS output
    console.log("start validating HLS stream for: " + newDirName);
    const validationErrors = await validate_hls(new_ts_file_dir, newDirName);

    if (validationErrors.length > 0) {
      console.error(
        `validation FAILED for ${newDirName} with ${validationErrors.length} error(s):`,
      );
      for (const err of validationErrors) {
        console.error("  - " + err);
      }

      // Write errors to log file
      write_validation_error_log(state.dir, newDirName, validationErrors);

      // Delete the broken ts_stream_convert directory
      console.log("deleting broken segments directory: " + new_ts_file_dir);
      rmSync(new_ts_file_dir, { recursive: true, force: true });

      console.log("skipping video due to validation errors: " + newDirName);
      continue;
    }

    console.log("validation PASSED for: " + newDirName);
  }

  return 0;
}

convert();
