import { mkdirSync, rmdirSync } from "fs";
import { Server } from "socket.io";
import * as p from "path";

//CHANGEME
const base_path = "users/";

export default async function start_socket_server(io: Server) {
  io.on("connection", (socket) => {
    console.log("socket id connected: ", socket.id);

    const { id } = socket;
    const user_folder = p.join(base_path, id);

    mkdirSync(user_folder);

    const user_stream_folder = p.join(user_folder, id + "_stream_data");

    mkdirSync(user_stream_folder);

    socket.on("disconnect", (_) => {
      rmdirSync(user_folder, { recursive: true });
      console.log("Client disconnected:", socket.id);
    });
  });
}
