import { appendFileSync, existsSync, writeFileSync } from "fs";
import * as p from "path";

export default async function create_question_index(
  base_path: string,
  video_file_name: string,
  is_first_video: boolean
): Promise<void> {
  const file_name = "question_index.csv";
  const csv_header = '"video_title";"video_id"\n';

  const file_path = p.join(base_path, file_name);

  const file_exits = existsSync(file_path);

  if (file_exits && is_first_video) {
    writeFileSync(file_path, "");
  } else if (!file_exits && is_first_video) {
    appendFileSync(file_path, csv_header);
  }

  const id_regex = /([^.]+\?)_([^.]+)/;

  const parsed_file_name = video_file_name.match(id_regex);

  if (!parsed_file_name)
    return console.log("provided a Filename without a id!");

  const video_id = parsed_file_name[2];
  const video_name = parsed_file_name[1];

  console.log("ID ", video_id, "NAME ", video_name);

  const row = `"${video_name}";"${video_id}"\n`;

  appendFileSync(file_path, row);
  console.log(`add video ${video_name} to question_index.txt`);

  return;
}
