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

// Global request deduplication cache
const requestCache = new Map();
const REQUEST_DEBOUNCE_TIME = 50; // Reduced from 150ms to 50ms

function isDuplicateRequest(userId: string, requestType: string): boolean {
  const key = `${userId}_${requestType}`;
  const now = Date.now();
  const lastRequest = requestCache.get(key);
  
  // Only block if it's truly a duplicate (very short time span)
  if (lastRequest && (now - lastRequest) < REQUEST_DEBOUNCE_TIME) {
    console.log(`Blocking duplicate ${requestType} request for user ${userId}`);
    return true;
  }
  
  requestCache.set(key, now);
  return false;
}

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
      return;
    }

    // For M3U8 files, only block if it's a truly rapid duplicate (within 50ms)
    if (filename.endsWith('.m3u8')) {
      if (isDuplicateRequest(id, 'M3U8')) {
        // Return cached response for truly duplicate requests
        const file_path = p.join(
          __dirname,
          "../../",
          save_accesing_env_field("USERS_FOLDER"),
          id,
          filename
        );
        res.status(200).sendFile(file_path);
        return;
      }
      
      console.log("Processing M3U8 request for user:", id);
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
      return;
    }

    // More conservative logic - only update segments for genuine forward progress
    const isForwardProgress = current_user.highestRequestedFile < segment;
    const isCorrectVideo = current_user.getCurrentQuestion().id == video_id;
    const now = Date.now();
    const timeSinceLastRequest = now - current_user.lastRequestTime;
    
    // Only process segment updates for forward progress with reasonable time gap
    if (isCorrectVideo && isForwardProgress && timeSinceLastRequest > 100) {
      console.log(`Processing segment update: ${segment}, user: ${user_id}`);
      
      current_user.highestRequestedFile = segment;
      current_user.lastRequestTime = now;
      
      let next_segment = find_next_segment_path(video_id, segment + 1, user_id);

      if (next_segment == "ENDING") {
        current_user.highestRequestedFile = 0;
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
    } else if (!isCorrectVideo) {
      console.log(`Skipping segment update: wrong video ${video_id} for user ${user_id}`);
    } else if (!isForwardProgress) {
      console.log(`Skipping segment update: not forward progress ${segment} for user ${user_id}`);
    } else {
      console.log(`Skipping segment update: too soon (${timeSinceLastRequest}ms) for user ${user_id}`);
    }
    
    const requested_file = get_ts_file_by_video_id(video_id, segment);
    console.log("Serving TS file:", requested_file);
    res.sendFile(p.join(requested_file));
  });
}
