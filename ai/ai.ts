import * as p from "path";
import {
  check_if_ids_exists,
  parse_ai_response,
  save_accesing_env_field,
  debug_log,
} from "../util/util";
import { readFileSync } from "fs";
import { GoogleGenAI } from "@google/genai";
import * as dns from "dns";

let cachedQuestionIndexPath = "";
let cachedQuestionIndexCsv = "";

function getQuestionIndexCsv(): string {
  const questionIndexPath = p.resolve(
    save_accesing_env_field("QUESTIONS_INDEX_PATH"),
  );

  if (
    cachedQuestionIndexPath !== questionIndexPath ||
    cachedQuestionIndexCsv.length === 0
  ) {
    cachedQuestionIndexPath = questionIndexPath;
    cachedQuestionIndexCsv = readFileSync(questionIndexPath, {
      encoding: "utf8",
    });
  }

  return cachedQuestionIndexCsv;
}

export function warmupQuestionIndexCache(): void {
  getQuestionIndexCsv();
}

// Generate AI prompt for creating a chain of "How to" questions
function generatePrompt(initial_question: string): string {
  return `
  **TASK**: 
  Create a chain of 50 "How to" questions starting from the initial question, with each question naturally transitioning to the next topic while maintaining a balance between hard skills (technical) and soft skills (interpersonal/personal development).

  **REQUIREMENTS**:
  1. **Question Chain**: Start with "${initial_question}?" and create 29 additional questions
  2. **Step-Ahead Logic**: Each new question must describe a necessary step that comes BEFORE the previous question (prerequisite)
  3. **Source**: All questions and video IDs must be selected from the provided 'question_index.csv' file

  **EXAMPLES**:
  - 'How to cut potatoes?' → 'How to sharpen a knife? (prerequisite step)
  - 'How to fold clothes?' → 'How to wash clothes?' → 'How to sort laundry?' → 'How to choose detergent?'
  - 'How to build a house?' → 'How to lay foundation?' → 'How to prepare building site?' → 'How to get building permit?' → 'How to find architect?'
  - 'How to fold?' → 'How to wash clothes?' → 'How to sort laundry?' → 'How to choose detergent?' → 'How to read labels?'
  - 'How to build a house?' → 'How to get building permit?' → 'How to find architect?' → 'How to plan budget?' → 'How to save money?'

  **INITIAL QUESTION**: "${initial_question}?"

  **DATA SOURCE INSTRUCTIONS**:
  - For question 1: Search 'question_index.csv' to find the video that best matches "${initial_question}?". Use the exact 'video_id' from that matching row for 'video_id_1'.
  - For questions 2-50: Select appropriate video titles and IDs from the dataset that match your question chain
  - No 'video_title' or 'video_id' should not be more then once in the list. 

  **OUTPUT FORMAT**: 
  - Provide exactly 50 questions + video_ids in the following valid JSON structure. 
  - CRITICAL: Every video_title (in the JSON) needs to have a video_title (from the CSV). Never leave video_title empty or blank.
  - CRITICAL: Every video_title (in the JSON) MUST have a corresponding video_id (from the CSV). Never leave video_id empty or blank.
  - Video titles must use spaces between words, never hyphens. For example: "How to fold clothes" not "How-to-fold-clothes".
  - Return only the JSON structure with no additional text, explanations, or formatting:

  [
      {
          "video_title_1": "${initial_question}?",
          "video_id_1": ""
      },
      (... 48 other objects ...)
      {
          "video_title_50": "",
          "video_id_50": ""
      }
  ]
    
  `;
}

// Generate a question chain using AI (single attempt, no retries)
export default async function generate_question(
  start_question: string,
): Promise<any> {
  start_question = start_question.replace(/[^A-Za-z0-9 _-]/g, "");

  // Prefer IPv4 over IPv6 to avoid network issues
  dns.setDefaultResultOrder("ipv4first");

  const api_key = save_accesing_env_field("GEMINI_API_KEY");

  const model = save_accesing_env_field("GEMINI_MODEL");

  const users_csv = getQuestionIndexCsv();
  const ai = new GoogleGenAI({ apiKey: api_key });

  let cache;
  try {
    cache = await ai.caches.create({
      model: model,
      config: {
        contents: users_csv,
        ttl: "60.0s",
      },
    });

    debug_log("AI Request for: " + start_question);
    const response = await ai.models.generateContent({
      model: model,
      contents: generatePrompt(start_question),
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
        cachedContent: cache.name,
      },
    });

    if (!response.text) {
      debug_log("got no response text!");
      throw new Error("AI_API_ERROR");
    }

    const parsed_response = parse_ai_response(response.text);

    if (!parsed_response) {
      debug_log("unvalid parsed_response");
      throw new Error("AI_API_ERROR");
    }

    if (!check_if_ids_exists(parsed_response, users_csv)) {
      debug_log(
        "Validation failed (missing ID, duplicate ID, or ID not found in CSV)",
      );
      throw new Error("AI_API_ERROR");
    }

    return parsed_response;
  } catch (error: any) {
    debug_log("Gemini API error:", error.message || error);
    throw new Error("AI_API_ERROR");
  } finally {
    if (cache?.name) {
      await ai.caches.delete({ name: cache.name }).catch(() => {});
      debug_log("Delete Cache!");
    }
  }
}
