import { Express } from "express";
import * as p from "path";
import {
  check_if_user_exits,
  get_ts_file_by_video_id,
  save_accesing_env_field,
} from "../util/util";
import {
  add_segment,
  addDiscontinuity,
  addStreamEnding,
  extract_ts_segment_number,
  find_next_segment_path,
} from "../util/m3u8_operations";
import User, { get_user_by_id, user_allready_saved } from "./users";

const html_name = "frontend/index.html";

export default async function start_http_server(
  server: Express,
  users: User[],
  io?: any
) {
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

    let current_user;

    if (!user_allready_saved(users, user_id)) {
      current_user = new User(user_id);
      users.push(new User(user_id));
    } else {
      current_user = get_user_by_id(users, user_id);
    }

    if (!check_if_user_exits(user_id)) {
      res.status(404).send("User not found!");
    }

    // Add next segment only when progressing forward AND it hasn't been added to playlist yet
    // This prevents duplicate segments when seeking to unbuffered areas
    if (
      segment >= current_user.highestRequestedFile &&
      current_user.getCurrentQuestion().id == video_id &&
      segment > current_user.highestAddedToPlaylist
    ) {
      current_user.highestRequestedFile = segment;
      current_user.highestAddedToPlaylist = segment;
      
      let next_segment = find_next_segment_path(video_id, segment + 1, user_id);

      if (next_segment == "ENDING") {
        current_user.highestRequestedFile = 0;
        current_user.highestAddedToPlaylist = -1; // Reset for new question
        const newQuestion = current_user.getNewQuestion();

        if (!newQuestion) {
          console.log("Stream from ", user_id, "has Ended!");
          addStreamEnding(user_id);
          
          // Notify frontend via socket if io is available
          if (io) {
            io.to(user_id).emit("STREAM_ENDED");
          }
          
          // Return 404 for ENDING requests to properly signal stream end
          res.status(404).send("Stream ended");
          return;
        } else {
          addDiscontinuity(user_id);
          console.log("NEW QUESTION ID!", newQuestion);
          next_segment = find_next_segment_path(newQuestion.id, 0, user_id);
        }
      }

      add_segment(user_id, next_segment, 1.0);
    } else if (segment > current_user.highestRequestedFile && current_user.getCurrentQuestion().id == video_id) {
      // Update highest requested when seeking forward, but don't add segments to avoid duplicates
      current_user.highestRequestedFile = segment;
    }
    const requested_file = get_ts_file_by_video_id(video_id, segment);
    console.log(requested_file);
    res.sendFile(p.join(requested_file));
  });
}
