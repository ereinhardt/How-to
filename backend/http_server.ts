import { Express } from "express";
import * as p from "path";
import {
  check_if_user_exits,
  get_ts_file_by_video_id,
  save_accesing_env_field,
} from "../util/util";
import {
  add_segment,
  extract_ts_segment_number,
  find_next_segment_path,
} from "../util/m3u8_operations";

const html_name = "frontend/index.html";

export default async function start_http_server(server: Express) {
  const ts_folder_name = save_accesing_env_field("VIDEO_TS_FOLDER_NAME");

  server.get("/", (req, res) => {
    res.sendFile(p.join(__dirname, `../../${html_name}`));
  });

  server.get("/:id/:filename", async (req, res) => {
    console.log("Requested File:", req.params.filename);

    const { filename, id } = req.params;

    const user_exists = check_if_user_exits(id);
    if (!user_exists) {
      res.status(404).send("Requested User not found!");
    }

    const file_path = p.join(
      __dirname,
      "../../",
      save_accesing_env_field("USERS_FOLDER"),
      id,
      filename
    );
    res.status(200).sendFile(file_path);
  });

  server.get(`/:video_id/:user_id/:filename`, (req, res) => {
    const { video_id, filename, user_id } = req.params;
    const segment = extract_ts_segment_number(filename);

    console.log("request Ts File!");
    if (!check_if_user_exits(user_id)) {
      res.status(404).send("User not found!");
    }

    let next_segment = find_next_segment_path(video_id, segment + 1, user_id);
    add_segment(user_id, next_segment, 1.0);
    next_segment = find_next_segment_path(video_id, segment + 2, user_id);
    add_segment(user_id, next_segment, 1.0);
    next_segment = find_next_segment_path(video_id, segment + 3, user_id);
    add_segment(user_id, next_segment, 1.0);
    next_segment = find_next_segment_path(video_id, segment + 4, user_id);
    add_segment(user_id, next_segment, 1.0);

    const requested_file = get_ts_file_by_video_id(video_id, segment);
    res.sendFile(p.join(__dirname, "../../", requested_file));
  });
}
