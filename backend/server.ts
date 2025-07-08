import express from "express";
import { createServer } from "http";
import * as p from "path";
import { Server } from "socket.io";
import start_socket_server from "./socket_server";

const port = 3000;
const host = "localhost";
const html_path = "./index.html";

const app = express();
const server = createServer(app);

app.get("/", (req, res) => {
  res.sendFile(p.join(__dirname, "../../index.html"));
});

start_socket_server(new Server(server));

server.listen(port, () => {
  console.log(`server running at http://${host}:${port}`);
});
