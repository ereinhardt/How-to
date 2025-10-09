import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import start_socket_server from "./socket_server";
import "dotenv/config";
import start_http_server from "./http_server";
import { save_accesing_env_field } from "../util/util";
import generate_question from "../ai/ai";
import User from "./users";
import cors from "cors";

// CRITICAL: Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION - Server continuing but this needs investigation:', error);
  // Don't exit in production - log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED PROMISE REJECTION at:', promise, 'reason:', reason);
  // Don't exit in production - log and continue
});

const port = save_accesing_env_field("SERVER_PORT");
const host = save_accesing_env_field("SERVER_HOST");

const app = express();
app.use(cors());

const server = createServer(app);

const users: User[] = [];

const io = new Server(server);

start_http_server(app, users, io);
start_socket_server(io, users);

server.listen(port, async () => {
  console.log(`server running at http://${host}:${port}`);

  //TEST;
  //await generate_question("How To Fold?");
});
