import { Express } from "express";
import * as p from "path";

const html_name = "frontend/index.html";

export default async function start_http_server(server: Express) {
  server.get("/", (req, res) => {
    res.sendFile(p.join(__dirname, `../../${html_name}`));
  });

  server.get("/:uuid/:filename", async (req, res) => {
    console.log(req.params.filename);
  });
}
