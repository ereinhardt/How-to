import { lstatSync, mkdirSync, readdirSync } from "fs";
import { copyFile, rename } from "fs/promises";
import { exec } from "child_process";

import * as p from "path";
import { argv, stdin, stdout } from "process";

const OPTS = ["dir"];

function parse_args(): string | undefined {
  const args = argv.slice(2);

  if (args.length > 1) {
    console.log("Too many arguments! Currently supported: dir");
    return;
  }

  if (args.find((arg) => !arg.includes("="))) {
    console.log(
      "could not Parse argument. Arguments should have following Structure: opt=value!"
    );
    return;
  }

  const opt = args[0].split("=");
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

      return optValue;

    default:
      throw Error("UNREACHABLE!");
  }
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
    "-start_number 0",
    "-level 6.0",
    "-crf 30",
    '-vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1"',
    "-g 1",
    "-hls_time 1",
    "-hls_list_size 0",
    "-hls_segment_filename",
    `${path}/${fileName}_%d.ts`,
    `${path}/${fileName}_playlist.m3u8`,
  ];

  return new Promise((resolve) => {
    exec("ffmpeg " + opts.join(" "), (e, stdout, stderr) => {
      if (!e) resolve();
      if (e) console.log(e);
    });
  });
}

async function convert(): Promise<number> {
  const path = parse_args();
  if (!path) return -1;

  const is_ffmpeg_installed = await check_ffmpeg_installation();

  if (!is_ffmpeg_installed) console.log("could not find a ffmpeg instalition!");

  console.log("Start Converting!");

  let dir = readdirSync(path);

  console.log(dir);

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

    const not_allready_created_dir = has_not_dir(video, path);

    if (!not_allready_created_dir) {
      console.log(
        "video has allready a folder skipped File with path: " + video
      );
      continue;
    }

    const newDirName = space_to_hyphen(remove_file_extension(video));

    console.log(path);

    const newDirPath = p.join(path, newDirName);
    console.log("made new dir at path: " + newDirPath);

    mkdirSync(newDirPath);

    const old_path = p.join(path, video);
    const new_path = p.join(newDirPath, space_to_hyphen(video));

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
  }

  return 0;
}

convert();
