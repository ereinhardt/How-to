import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import start_socket_server from "./socket_server";
import "dotenv/config";
import start_http_server from "./http_server";

const port = 3000;
const host = "localhost";

const app = express();
const server = createServer(app);

start_http_server(app);
start_socket_server(new Server(server));

server.listen(port, () => {
  console.log(`server running at http://${host}:${port}`);
});
