import express from "express";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import * as p from "path";
import start_socket_server from "./socket_server";
import "dotenv/config";
import start_http_server from "./http_server";
import {
  save_accesing_env_field,
  save_accesing_env_field_with_ip_detection,
  warmupVideoMetadataCache,
  debug_error,
} from "../util/util";
import { warmupQuestionIndexCache } from "../ai/ai";
import User from "./users";
import cors from "cors";

function resolveFromRoot(targetPath: string): string {
  return p.isAbsolute(targetPath)
    ? targetPath
    : p.join(process.cwd(), targetPath);
}

function ensureStartupPaths(): void {
  const usersFolderPath = resolveFromRoot("users");
  const userQuestionIndexPath = resolveFromRoot("user_question_index.txt");

  rmSync(usersFolderPath, { recursive: true, force: true });
  mkdirSync(usersFolderPath, { recursive: true });

  mkdirSync(p.dirname(userQuestionIndexPath), { recursive: true });

  if (!existsSync(userQuestionIndexPath)) {
    writeFileSync(userQuestionIndexPath, "", { flag: "wx" });
  }
}

// Handle uncaught exceptions to prevent server crashes
process.on("uncaughtException", (error) => {
  debug_error(
    "UNCAUGHT EXCEPTION - Server continuing but this needs investigation:",
    error,
  );
});

// Handle unhandled promise rejections to prevent crashes
process.on("unhandledRejection", (reason, promise) => {
  debug_error("UNHANDLED PROMISE REJECTION at:", promise, "reason:", reason);
});

const port = parseInt(save_accesing_env_field("SERVER_PORT"));
const host = save_accesing_env_field_with_ip_detection("SERVER_HOST");

ensureStartupPaths();
warmupVideoMetadataCache();
warmupQuestionIndexCache();

const app = express();
app.use(cors());

const server = createServer(app);
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

const users: User[] = [];

const io = new Server(server, {
  cors: {
    origin: "*",
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 30000,
});

start_http_server(app, users, io);
start_socket_server(io, users);

// Start server and log startup message
server.listen(port, host, async () => {
  console.log(`server running at http://${host}:${port}`);
});
