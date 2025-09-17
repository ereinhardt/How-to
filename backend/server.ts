import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import start_socket_server from "./socket_server";
import "dotenv/config";
import start_http_server from "./http_server";
import { save_accesing_env_field } from "../util/util";
import generate_question from "../ai/ai";
import User from "./users";

const port = save_accesing_env_field("SERVER_PORT");
const host = save_accesing_env_field("SERVER_HOST");

const app = express();
const server = createServer(app);

const users: User[] = [];

start_http_server(app, users);
start_socket_server(new Server(server), users);

server.listen(port, async () => {
  console.log(`server running at http://${host}:${port}`);

  //TEST;
  await generate_question("How To Fold?");
});
