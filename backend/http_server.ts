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

// Start HTTP server with routes for serving frontend and video files
export default async function start_http_server(
  server: Express,
  users: User[],
  io?: any
) {
  // Serve the main frontend HTML file
  server.get("/", (req, res) => {
    res.sendFile(p.join(__dirname, `../../${html_name}`));
  });

  // Serve user-specific files by user ID and filename
  server.get("/:id/:filename", async (req, res) => {
    try {
      console.log("Requested File:", req.params.filename);

      const { filename, id } = req.params;

      const user_exists = check_if_user_exits(id);
      if (!user_exists) {
        res.status(404).send("Requested User not found!");
        return;
      }

      const file_path = p.join(
        __dirname,
        "../../",
        save_accesing_env_field("USERS_FOLDER"),
        id,
        filename
      );

      res.sendFile(file_path, (err) => {
        if (err) {
          console.error(`ERROR sending file ${file_path}:`, err.message);
          if (!res.headersSent) {
            res.status(404).send("File not found");
          }
        }
      });
    } catch (error: any) {
      console.error(`CRITICAL ERROR in /:id/:filename route:`, error.message);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  });

  // Handle video segment requests and manage streaming playlists
  server.get(`/:video_id/:user_id/:filename`, (req, res) => {
    try {
      const { video_id, filename, user_id } = req.params;
      const segment = extract_ts_segment_number(filename);

      if (segment === -1) {
        res.status(400).send("Invalid segment number");
        return;
      }

      let current_user: User | null;

      if (!user_allready_saved(users, user_id)) {
        current_user = new User(user_id);
        users.push(current_user);
      } else {
        current_user = get_user_by_id(users, user_id);
      }

      if (!current_user) {
        res.status(404).send("User creation/retrieval failed!");
        return;
      }

      if (!check_if_user_exits(user_id)) {
        res.status(404).send("User not found!");
        return;
      }

      if (
        segment >= current_user.highestRequestedFile &&
        current_user.getCurrentQuestion().id == video_id &&
        segment > current_user.highestAddedToPlaylist
      ) {
        current_user.highestRequestedFile = segment;
        current_user.highestAddedToPlaylist = segment;

        let next_segment = find_next_segment_path(
          video_id,
          segment + 1,
          user_id
        );

        if (next_segment == "ENDING") {
          current_user.highestRequestedFile = 0;
          current_user.highestAddedToPlaylist = -1; 
          const newQuestion = current_user.getNewQuestion();

          if (!newQuestion) {
            console.log("Stream from ", user_id, "has Ended!");
            addStreamEnding(user_id);

            if (io) {
              io.to(user_id).emit("STREAM_ENDED");
            }

            res.status(404).send("Stream ended");
            return;
          } else {
            addDiscontinuity(user_id);
            console.log("NEW QUESTION ID!", newQuestion);
            next_segment = find_next_segment_path(newQuestion.id, 0, user_id);
          }
        }

        add_segment(user_id, next_segment, 1.0);
      } else if (
        segment > current_user.highestRequestedFile &&
        current_user.getCurrentQuestion().id == video_id
      ) {
        current_user.highestRequestedFile = segment;
      }

      const requested_file = get_ts_file_by_video_id(video_id, segment);
      if (!requested_file) {
        res.status(404).send("Video file not found");
        return;
      }

      console.log(requested_file);
      res.sendFile(p.join(requested_file), (err) => {
        if (err) {
          console.error(
            `ERROR sending video file ${requested_file}:`,
            err.message
          );
          if (!res.headersSent) {
            res.status(404).send("Video file not found");
          }
        }
      });
    } catch (error: any) {
      console.error(`CRITICAL ERROR in video route:`, error.message);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  });
}
