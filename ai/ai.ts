import * as p from "path";
import { save_accesing_env_field } from "../util/util";
import { readFileSync } from "fs";
import { GoogleGenAI } from "@google/genai";

export default async function generate_question(start_question: string) {
  const video_folder = save_accesing_env_field("VIDEOS_PATH");
  const api_key = save_accesing_env_field("GEMINI_API_KEY");

  const users_questions_path = p.join(
    __dirname,
    "../../",
    video_folder,
    "question_index.csv"
  );

  const users_csv = readFileSync(users_questions_path, { encoding: "utf8" });
  const ai = new GoogleGenAI({ apiKey: api_key });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Erzähle mir ein witz über Informatiker!",
  });

  console.log(response.text);
}
