import { mkdirSync, rmdirSync } from "fs";
import { Server } from "socket.io";
import * as p from "path";

//CHANGEME
const base_path = "users/";

export default async function start_socket_server(io: Server) {
  io.on("connection", (socket) => {
    console.log("socket id connected: ", socket.id);

    const { id } = socket;
    const folder = p.join(base_path, id);
    mkdirSync(folder);

    socket.on("disconnect", (_) => {
      rmdirSync(folder, { recursive: true });
      console.log("Client disconnected:", socket.id);
    });
  });
}
