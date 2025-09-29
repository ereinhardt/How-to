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

  // Global cache for M3U8 requests to prevent excessive reloads
  const m3u8Cache = new Map();
  
  server.get("/:id/:filename", async (req, res) => {
    console.log("Requested File:", req.params.filename);

    const { filename, id } = req.params;

    const user_exists = check_if_user_exits(id);
    if (!user_exists) {
      res.status(404).send("Requested User not found!");
      return;
    }

    // Aggressive rate limiting for M3U8 manifest requests
    if (filename.endsWith('.m3u8')) {
      const cacheKey = `${id}_${filename}`;
      const now = Date.now();
      const lastRequest = m3u8Cache.get(cacheKey);
      
      // Allow M3U8 requests only every 800ms minimum
      if (lastRequest && now - lastRequest < 800) {
        console.log(`Rate limiting M3U8 request for ${id}, last request was ${now - lastRequest}ms ago`);
        // Return the same file but don't update cache timestamp
      } else {
        m3u8Cache.set(cacheKey, now);
        console.log(`Allowing M3U8 request for ${id}`);
      }
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

  // Cache for TS segment requests to prevent duplicate processing
  const tsSegmentCache = new Map();
  
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

    // Create unique key for this segment request
    const segmentKey = `${user_id}_${video_id}_${segment}`;
    const now = Date.now();
    const lastSegmentRequest = tsSegmentCache.get(segmentKey);
    
    // Prevent duplicate segment processing within 500ms
    const shouldProcessSegment = !lastSegmentRequest || (now - lastSegmentRequest) > 500;
    
    // Only update segment tracking if this is forward progress or a significant jump back
    const isForwardProgress = current_user.highestRequestedFile <= segment;
    const isSignificantJumpBack = current_user.highestRequestedFile - segment > 10;
    const isCorrectVideo = current_user.getCurrentQuestion().id == video_id;
    
    if (shouldProcessSegment && (isForwardProgress || isSignificantJumpBack) && isCorrectVideo) {
      // Only update if not seeking or if this is a significant change
      const timeSinceLastUserRequest = now - current_user.lastRequestTime;
      
      // More strict timing - only process if 1 second has passed or it's genuine forward progress
      if (timeSinceLastUserRequest > 1000 || (isForwardProgress && segment > current_user.highestRequestedFile)) {
        console.log(`Processing segment ${segment} for user ${user_id}`);
        
        current_user.highestRequestedFile = segment;
        current_user.lastRequestTime = now;
        tsSegmentCache.set(segmentKey, now);
        
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
      } else {
        console.log(`Skipping duplicate segment processing for ${segment}, user ${user_id}`);
      }
    } else if (!shouldProcessSegment) {
      console.log(`Rate limiting segment ${segment} for user ${user_id}`);
    }
    
    const requested_file = get_ts_file_by_video_id(video_id, segment);
    console.log(requested_file);
    res.sendFile(p.join(requested_file));
  });
}
