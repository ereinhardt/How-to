import {
  appendFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { Server } from "socket.io";
import * as p from "path";
import {
  save_accesing_env_field,
  getSegmentDuration,
  debug_log,
  debug_error,
} from "../util/util";
import {
  add_segment,
  create_user_m3u8,
  find_next_segment_path,
} from "../util/m3u8_operations";
import User, { get_user_by_id, remove_user_by_id } from "./users";

const REQUEST_COUNT_PATH = p.join(process.cwd(), "backend", "request_count.json");

// Current date as YYYY-MM-DD (server time)
function getRequestCountDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Read today's AI request count from disk (0 if missing or from a previous day)
function readAiRequestCount(): number {
  try {
    const data = JSON.parse(readFileSync(REQUEST_COUNT_PATH, "utf-8"));
    if (data.date === getRequestCountDate()) return data.count;
  } catch {}
  return 0;
}

// Persist today's AI request count to disk
function writeAiRequestCount(count: number): void {
  writeFileSync(
    REQUEST_COUNT_PATH,
    JSON.stringify({ date: getRequestCountDate(), count }),
  );
}

// Start socket server and handle client connections
export default async function start_socket_server(io: Server, users: User[]) {
  const maxUsers = parseInt(save_accesing_env_field("MAX_USERS"));
  const maxAiRequests = parseInt(save_accesing_env_field("MAX_AI_REQUESTS"));
  const cleanupTimeouts = new Map<string, NodeJS.Timeout>();
  const socketUserMap = new Map<string, string>();
  let pendingSearches = new Set<string>();

  // Handle new client connections
  io.on("connection", (socket) => {
    debug_log("socket id connected: ", socket.id);

    const base_path = "users";
    let leaving = false;

    socket.on("LEAVE", () => {
      leaving = true;
    });

    // Handle client disconnection and cleanup (with grace period for tunnel reconnects)
    socket.on("disconnect", (reason) => {
      debug_log("Client disconnected:", socket.id, "reason:", reason);
      const userId = socketUserMap.get(socket.id) || socket.id;
      const userFolder = p.join(base_path, userId);
      socketUserMap.delete(socket.id);

      const user = get_user_by_id(users, userId);
      const isStreaming = user && user.questions.length > 0;
      const skipGrace = leaving || reason === "client namespace disconnect";
      const delay = isStreaming && !skipGrace ? 60000 : 0;

      if (skipGrace && user) user.reset();
      pendingSearches.delete(userId);

      const timeout = setTimeout(() => {
        cleanupTimeouts.delete(userId);
        try {
          rmSync(userFolder, { recursive: true, force: true });
          remove_user_by_id(users, userId);
          debug_log("Cleaned up user after grace period:", userId);
        } catch (error: any) {
          debug_error(
            `ERROR during disconnect cleanup for ${userId}:`,
            error.message,
          );
        }
      }, delay);

      cleanupTimeouts.set(userId, timeout);
    });

    // Handle stream resume after socket reconnect (e.g. CDN tunnel rotation)
    socket.on("RESUME_STREAM", (oldId: string) => {
      if (typeof oldId !== "string" || !oldId) {
        socket.emit("RESUME_FAILED");
        return;
      }

      const oldUser = get_user_by_id(users, oldId);
      if (!oldUser || oldUser.questions.length === 0) {
        debug_log(`RESUME_STREAM failed: no active stream for ${oldId}`);
        socket.emit("RESUME_FAILED");
        return;
      }

      // Cancel pending cleanup of old user
      const pendingTimeout = cleanupTimeouts.get(oldId);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        cleanupTimeouts.delete(oldId);
      }

      // Map new socket to old user so disconnect cleanup targets the right user
      socketUserMap.set(socket.id, oldId);

      // Join room with old ID so io.to(oldId) reaches this socket
      socket.join(oldId);

      debug_log(`Socket ${socket.id} resumed stream for user ${oldId}`);
      socket.emit("RESUME_SUCCESS");
    });

    // Handle new search requests and generate question chains
    socket.on("NEW_SEARCH", async (user_data) => {
      const { search } = user_data;

      // Read today's count from disk (auto-resets when the date changes)
      let aiRequestCount = readAiRequestCount();

      if (aiRequestCount >= maxAiRequests) {
        debug_log(`AI request limit (${maxAiRequests}/24h) reached`);
        socket.emit("AI_LIMIT_REACHED");
        return;
      }

      // Check if max active users reached (including pending async searches)
      const activeUsers = users.filter((u) => u.questions.length > 0).length;
      if (activeUsers + pendingSearches.size >= maxUsers) {
        debug_log(
          `Max users (${maxUsers}) reached, rejecting search from ${socket.id}`,
        );
        socket.emit("SERVER_BUSY", {
          message: "Server is busy. Please try again later.",
        });
        return;
      }

      // Create user and folder on first search (not on connection)
      const { id } = socket;
      const user_folder = p.join(base_path, id);

      if (!get_user_by_id(users, id)) {
        users.push(new User(id));
      } else {
        get_user_by_id(users, id)!.reset();
      }

      rmSync(user_folder, { recursive: true, force: true });

      try {
        mkdirSync(user_folder, { recursive: true });
      } catch (error: any) {
        debug_error(
          `ERROR creating directories for user ${id}:`,
          error.message,
        );
        socket.emit("SETUP_ERROR", {
          message: "Failed to create user directories",
        });
        return;
      }

      const user_question_index_path = "user_question_index.txt";

      const user = get_user_by_id(users, socket.id);

      if (!user) {
        debug_error(`CRITICAL: User ${socket.id} not found during NEW_SEARCH`);
        socket.emit("SEARCH_ERROR", {
          message: "User session not found. Please refresh.",
        });
        return;
      }

      pendingSearches.add(socket.id);
      aiRequestCount++;
      writeAiRequestCount(aiRequestCount);
      try {
        await user.generateUpcommingQuestions(search);
        pendingSearches.delete(socket.id);

        debug_log(user);

        appendFileSync(user_question_index_path, search + "\n");

        const stream_file_path = create_user_m3u8(id, user_folder);

        const user_stream_file_url = `/${stream_file_path}`;

        const currentQuestion = user.getCurrentQuestion();

        const first_segment = find_next_segment_path(
          currentQuestion.id,
          0,
          socket.id,
        );

        const segment_length = getSegmentDuration(currentQuestion.id, 0);
        add_segment(socket.id, first_segment, segment_length);

        socket.emit("START_STREAM", user_stream_file_url, user);
      } catch (error: any) {
        pendingSearches.delete(socket.id);
        debug_log("Error in NEW_SEARCH:", error.message || error);

        if (error.message === "AI_API_ERROR") {
          debug_log("Sending AI_API_ERROR to frontend");
          socket.emit("AI_API_ERROR", {
            message: "AI API error occurred. Resetting search.",
          });
        } else {
          socket.emit("SEARCH_ERROR", {
            message:
              "An error occurred while processing your search. Please try again.",
          });
        }
      }
    });
  });
}
