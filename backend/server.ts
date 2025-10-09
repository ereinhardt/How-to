import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import start_socket_server from "./socket_server";
import "dotenv/config";
import start_http_server from "./http_server";
import { save_accesing_env_field, save_accesing_env_field_with_ip_detection } from "../util/util";
import generate_question from "../ai/ai";
import User from "./users";
import cors from "cors";

// Handle uncaught exceptions to prevent server crashes
process.on("uncaughtException", (error) => {
  console.error(
    "UNCAUGHT EXCEPTION - Server continuing but this needs investigation:",
    error
  );
});

// Handle unhandled promise rejections to prevent crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED PROMISE REJECTION at:", promise, "reason:", reason);
});

const port = parseInt(save_accesing_env_field("SERVER_PORT"));
const host = save_accesing_env_field_with_ip_detection("SERVER_HOST");

const app = express();
app.use(cors());

const server = createServer(app);

const users: User[] = [];

const io = new Server(server);

start_http_server(app, users, io);
start_socket_server(io, users);

// Start server and log startup message
server.listen(port, host, async () => {
  console.log(`server running at http://${host}:${port}`);

});
