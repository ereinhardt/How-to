import { lstatSync, mkdirSync, readdirSync } from "fs";
import { copyFile, rename } from "fs/promises";
import { exec } from "child_process";

import * as p from "path";
import { argv, stdin, stdout } from "process";
import create_question_index from "./create_question_index";

interface arg_state {
  dir: string;
  question_index?: boolean;
}

const OPTS = ["dir", "create_question_index"];

function parse_args(): arg_state | undefined {
  const args = argv.slice(2);

  const state: arg_state = {
    dir: "",
    question_index: true,
  };

  if (args.find((arg) => !arg.includes("="))) {
    console.log(
      "could not Parse argument. Arguments should have following Structure: opt=value!"
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

      case "create_question_index":
        if (optValue != "true" && optValue != "false") {
          console.log("expected a boolean for create_question_index");
          return;
        }

        state.question_index = optValue == "true" ? true : false;

        break;
      default:
        throw Error("UNREACHABLE!");
    }
  }

  return state;
}

function parse_file_end(fileName: string): string {
  let current_index = fileName.length - 1;
  let current_char = fileName[current_index];
  let file_extension = "";

  while (current_char != "." && current_index >= 0) {
    file_extension = current_char + file_extension;
    current_index--;
    current_char = fileName[current_index];
  }

  //wenn es keine extension gibt, dann gib leeren string
  if (fileName == file_extension) {
    return "";
  }

  return file_extension;
}

function has_id(fileName: string): boolean {
  return fileName.includes("_");
}

function has_not_dir(fileName: string, path: string): boolean {
  const dir = readdirSync(path);

  const dirs_in_dir = dir.filter((f) =>
    lstatSync(p.join(path, fileName)).isDirectory()
  );

  return dirs_in_dir.find((f) => f.includes(space_to_hyphen(f))) ? false : true;
}

function remove_file_extension(fileName: string): string {
  const extension = parse_file_end(fileName);

  if (!extension)
    throw Error(
      "attempt to remove file extension for a file without a extension!"
    );

  return fileName.replace("." + extension, "");
}

function space_to_hyphen(str: string): string {
  return str.replace(/\s/g, "-");
}

function remove_question_marks(str: string): string {
  return str.replace(/[\?\uF025]/g, "");
}

async function check_ffmpeg_installation(): Promise<boolean> {
  return new Promise((resolve) => {
    exec("ffmpeg -version", (error) => {
      resolve(!error);
    });
  });
}

async function convert_to_fs(
  path: string,
  fileName: string,
  input_path: string
): Promise<void> {
  const opts = [
    `-i ${input_path}`,
    "-profile:v baseline",
    "-filter:v fps=25",
    "-start_number 0",
    "-level 6.0",
    "-crf 30",
    '-vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1"',
    "-g 1",
    "-ac 2", 
    "-hls_time 1",
    "-hls_list_size 0",
    "-hls_segment_filename",
    `${path}/${fileName}__%d.ts`,
    `${path}/${fileName}_playlist.m3u8`,
  ];

  return new Promise((resolve, reject) => {
    exec(
      "ffmpeg " + opts.join(" "),
      { maxBuffer: 1024 * 1024 * 1024 }, // (cuurent 1 GB) Set a larger buffer size here
      (e, stdout, stderr) => {
        if (!e) {
          resolve();
        } else {
          console.error("FFmpeg conversion error:", e);
          reject(e);
        }
      }
    );
  });
}

async function convert(): Promise<number> {
  const state = parse_args();
  if (!state) return -1;

  const is_ffmpeg_installed = await check_ffmpeg_installation();

  if (!is_ffmpeg_installed)
    console.log(
      "could not find a ffmpeg installation please look at https://ffmpeg.org!"
    );

  console.log("Start Converting!");

  let dir = readdirSync(state.dir);

  /*
  macOS legt auf nicht-APFS/HFS+-formatierten Laufwerken 
  (wie FAT32, exFAT oder NTFS – z. B. auf USB-Sticks, externen SSDs) 
  sogenannte AppleDouble-Dateien an.
  */
  dir = dir.filter((file) => !file.startsWith("._"));

  let is_first_video = true;

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
        "video has allready a folder skipped File with path: " + video
      );
      continue;
    }

    const newDirName = remove_question_marks(
      space_to_hyphen(remove_file_extension(video))
    );

    console.log(state.dir);

    const newDirPath = p.join(state.dir, newDirName);
    console.log("made new dir at path: " + newDirPath);

    mkdirSync(newDirPath);

    const old_path = p.join(state.dir, video);
    const new_path = p.join(
      newDirPath,
      remove_question_marks(space_to_hyphen(video))
    );

    console.log(`start moving file from ${old_path} to ${newDirPath}`);
    await rename(old_path, new_path);

    const new_ts_file_dir = p.join(newDirPath, "ts_stream_convert");

    console.log("created a ts_stream_convert folder for: " + video);
    mkdirSync(new_ts_file_dir);

    console.log(
      "start converting file to m3u8 hls stream! FileName: " + newDirName
    );
    await convert_to_fs(new_ts_file_dir, newDirName, new_path);
    console.log(
      "sucessfull converting file to m3u8 hls stream! FileName: " + newDirName
    );

    if (state.question_index) {
      await create_question_index(state.dir, newDirName, is_first_video);
    }

    is_first_video = false;
  }

  return 0;
}

convert();