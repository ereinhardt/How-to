import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { Server } from "socket.io";
import * as p from "path";
import { save_accesing_env_field } from "../util/util";
import {
  add_segment,
  create_user_m3u8,
  find_next_segment_path,
} from "../util/m3u8_operations";
import User, { get_user_by_id, remove_user_by_id } from "./users";

export default async function start_socket_server(io: Server, users: User[]) {
  io.on("connection", (socket) => {
    console.log("socket id connected: ", socket.id);
    users.push(new User(socket.id));

    const base_path = save_accesing_env_field("USERS_FOLDER");

    const { id } = socket;
    const user_folder = p.join(base_path, id);

    console.log(user_folder);
    
    try {
      // CRITICAL FIX: Safe directory creation
      mkdirSync(user_folder, { recursive: true });
      const user_stream_folder = p.join(user_folder, id + "_stream_data");
      mkdirSync(user_stream_folder, { recursive: true });
    } catch (error: any) {
      console.error(`ERROR creating directories for user ${id}:`, error.message);
      socket.emit("SETUP_ERROR", { message: "Failed to create user directories" });
      return;
    }

    socket.on("disconnect", (_) => {
      try {
        rmSync(user_folder, { recursive: true, force: true });
        console.log("Client disconnected:", socket.id);
        remove_user_by_id(users, socket.id);
      } catch (error: any) {
        console.error(`ERROR during disconnect cleanup for ${socket.id}:`, error.message);
        // Continue anyway - user is disconnecting
      }
    });

    socket.on("NEW_SEARCH", async (user_data) => {
      const { search, is_first } = user_data;

      const user_question_index_path = save_accesing_env_field(
        "USER_QUESTION_INDEX"
      );

      const user = get_user_by_id(users, socket.id);
      
      if (!user) {
        console.error(`CRITICAL: User ${socket.id} not found during NEW_SEARCH`);
        socket.emit("SEARCH_ERROR", { message: "User session not found. Please refresh." });
        return;
      }
      
      try {
        await user.generateUpcommingQuestions(search);

        console.log(user);

        appendFileSync(user_question_index_path, search + "\n");

        //const dummy = "How to fold!";
        const stream_file_path = create_user_m3u8(id, user_folder);

        const server_port = save_accesing_env_field("SERVER_PORT");
        const server_host = save_accesing_env_field("SERVER_HOST");
        const user_stream_file_url = `http://${server_host}:${server_port}/${stream_file_path}`;

        if (save_accesing_env_field("DEBUG_SERVER") == "1") {
          const dummy_id = save_accesing_env_field("DUMMY_ID");

          const first_segment = find_next_segment_path(dummy_id, 0, socket.id);

          const segment_length = 1.0;

          add_segment(socket.id, first_segment, segment_length);
        } else if (save_accesing_env_field("DEBUG_SERVER") == "0") {
          const currentQuestion = user.getCurrentQuestion();

          const first_segment = find_next_segment_path(
            currentQuestion.id,
            0,
            socket.id
          );

          const segment_length = 1.0;
          add_segment(socket.id, first_segment, segment_length);
        }

        socket.emit("START_STREAM", user_stream_file_url, user);
        
      } catch (error: any) {
        console.log("Error in NEW_SEARCH:", error.message || error);
        
        if (error.message === 'GEMINI_API_ERROR') {
          console.log("Sending GEMINI_API_ERROR to frontend");
          socket.emit("GEMINI_API_ERROR", { 
            message: "Gemini API error occurred. Resetting search." 
          });
        } else if (error.message === 'MAX_RETRIES_REACHED') {
          console.log("Maximum retries reached - resetting search");
          socket.emit("MAX_RETRIES_ERROR", { 
            message: "Maximum retry attempts reached. Please try a different search." 
          });
        } else {
          // For other errors, send generic error
          socket.emit("SEARCH_ERROR", { 
            message: "An error occurred while processing your search. Please try again." 
          });
        }
      }
    });
  });
}
