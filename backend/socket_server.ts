import { appendFileSync, mkdirSync, rmdirSync, writeFileSync } from "fs";
import { Server } from "socket.io";
import * as p from "path";
import { save_accesing_env_field } from "../util/util";
import {
  add_segment,
  create_user_m3u8,
  find_next_segment_path,
} from "../util/m3u8_operations";

export default async function start_socket_server(io: Server) {
  io.on("connection", (socket) => {
    console.log("socket id connected: ", socket.id);

    const base_path = save_accesing_env_field("USERS_FOLDER");

    const { id } = socket;
    const user_folder = p.join(base_path, id);

    console.log(user_folder);
    mkdirSync(user_folder);

    const user_stream_folder = p.join(user_folder, id + "_stream_data");

    mkdirSync(user_stream_folder);

    socket.on("disconnect", (_) => {
      rmdirSync(user_folder, { recursive: true });
      console.log("Client disconnected:", socket.id);
    });

    socket.on("NEW_SEARCH", (user_data) => {
      const { search, is_first } = user_data;

      const user_question_index_path = save_accesing_env_field(
        "USER_QUESTION_INDEX"
      );

      appendFileSync(user_question_index_path, search + "\n");

      //TODO ADD AI LAYER
      //const dummy = "How to fold!";
      const stream_file_path = create_user_m3u8(id, user_folder);

      const server_port = save_accesing_env_field("SERVER_PORT");
      const server_host = save_accesing_env_field("SERVER_HOST");
      const user_stream_file_url = `http://${server_host}:${server_port}/${stream_file_path}`;

      if (save_accesing_env_field("DEBUG_SERVER") == "1") {
        const dummy_id = save_accesing_env_field("DUMMY_ID");

        const first_segment = find_next_segment_path(dummy_id, 0);

        const segment_length = 1.0;

        add_segment(socket.id, first_segment, segment_length);
      }

      socket.emit("START_STREAM", user_stream_file_url);
    });
  });
}
