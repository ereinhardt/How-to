import * as p from "path";
import {
  check_if_ids_exists,
  parse_ai_response,
  save_accesing_env_field,
} from "../util/util";
import { readFileSync } from "fs";
import { GoogleGenAI } from "@google/genai";

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
  - CRITICAL: Every video_title MUST have a corresponding video_id. Never leave video_id empty or blank.
  - Return only the JSON structure with no additional text, explanations, or formatting:

  [
      {
          "video_title_1": "${initial_question}?",
          "video_id_1": ""
      },
      {
          "video_title_2": "",
          "video_id_2": ""
      },
      {
          "video_title_3": "",
          "video_id_3": ""
      },
      {
          "video_title_4": "",
          "video_id_4": ""
      },
      {
          "video_title_5": "",
          "video_id_5": ""
      },
      {
          "video_title_6": "",
          "video_id_6": ""
      },
      {
          "video_title_7": "",
          "video_id_7": ""
      },
      {
          "video_title_8": "",
          "video_id_8": ""
      },
      {
          "video_title_9": "",
          "video_id_9": ""
      },
      {
          "video_title_10": "",
          "video_id_10": ""
      },
      {
          "video_title_11": "",
          "video_id_11": ""
      },
      {
          "video_title_12": "",
          "video_id_12": ""
      },
      {
          "video_title_13": "",
          "video_id_13": ""
      },
      {
          "video_title_14": "",
          "video_id_14": ""
      },
      {
          "video_title_15": "",
          "video_id_15": ""
      },
      {
          "video_title_16": "",
          "video_id_16": ""
      },
      {
          "video_title_17": "",
          "video_id_17": ""
      },
      {
          "video_title_18": "",
          "video_id_18": ""
      },
      {
          "video_title_19": "",
          "video_id_19": ""
      },
      {
          "video_title_20": "",
          "video_id_20": ""
      },
      {
          "video_title_21": "",
          "video_id_21": ""
      },
      {
          "video_title_22": "",
          "video_id_22": ""
      },
      {
          "video_title_23": "",
          "video_id_23": ""
      },
      {
          "video_title_24": "",
          "video_id_24": ""
      },
      {
          "video_title_25": "",
          "video_id_25": ""
      },
      {
          "video_title_26": "",
          "video_id_26": ""
      },
      {
          "video_title_27": "",
          "video_id_27": ""
      },
      {
          "video_title_28": "",
          "video_id_28": ""
      },
      {
          "video_title_29": "",
          "video_id_29": ""
      },
      {
          "video_title_30": "",
          "video_id_30": ""
      },
      {
          "video_title_31": "",
          "video_id_31": ""
      },
      {
          "video_title_32": "",
          "video_id_32": ""
      },
      {
          "video_title_33": "",
          "video_id_33": ""
      },
      {
          "video_title_34": "",
          "video_id_34": ""
      },
      {
          "video_title_35": "",
          "video_id_35": ""
      },
      {
          "video_title_36": "",
          "video_id_36": ""
      },
      {
          "video_title_37": "",
          "video_id_37": ""
      },
      {
          "video_title_38": "",
          "video_id_38": ""
      },
      {
          "video_title_39": "",
          "video_id_39": ""
      },
      {
          "video_title_40": "",
          "video_id_40": ""
      },
      {
          "video_title_41": "",
          "video_id_41": ""
      },
      {
          "video_title_42": "",
          "video_id_42": ""
      },
      {
          "video_title_43": "",
          "video_id_43": ""
      },
      {
          "video_title_44": "",
          "video_id_44": ""
      },
      {
          "video_title_45": "",
          "video_id_45": ""
      },
      {
          "video_title_46": "",
          "video_id_46": ""
      },
      {
          "video_title_47": "",
          "video_id_47": ""
      },
      {
          "video_title_48": "",
          "video_id_48": ""
      },
      {
          "video_title_49": "",
          "video_id_49": ""
      },
      {
          "video_title_50": "",
          "video_id_50": ""
      }
  ]
    
  `;
}

export default async function generate_question(
  start_question: string,
  retryCount: number = 0
): Promise<any> {
  const MAX_RETRIES = 5; // Set the maximum number of retries here (e.g., 5)

  if (retryCount >= MAX_RETRIES) {
    console.log(
      `Maximum retries (${MAX_RETRIES}) reached for question: "${start_question}"`
    );
    throw new Error("MAX_RETRIES_REACHED");
  }

  const video_folder = save_accesing_env_field("VIDEOS_PATH");
  const api_key = save_accesing_env_field("GEMINI_API_KEY");

  const model = "gemini-2.5-flash";

  const users_questions_path = p.join(video_folder, "question_index.csv");

  const users_csv = readFileSync(users_questions_path, { encoding: "utf8" });
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

    console.log("AI Request for: " + start_question);
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
      console.log("got no response text!");
      await ai.caches.delete({ name: cache.name! });
      console.log("Delete Cache!");
      return await generate_question(start_question, retryCount + 1);
    }

    const parsed_response = parse_ai_response(response.text);

    if (!parsed_response) {
      console.log("unvalid parsed_response");
      await ai.caches.delete({ name: cache.name! });
      console.log("Delete Cache!");
      return await generate_question(start_question, retryCount + 1);
    }

    if (!check_if_ids_exists(parsed_response, users_csv)) {
      console.log(
        "Validation failed (missing ID, duplicate ID, or ID not found in CSV) - retrying..."
      );
      await ai.caches.delete({ name: cache.name! });
      console.log("Delete Cache!");
      return await generate_question(start_question, retryCount + 1);
    }

    // Only delete cache on success
    await ai.caches.delete({ name: cache.name! });
    console.log("Delete Cache!");
    return parsed_response;
  } catch (error: any) {
    // Check for various Gemini API errors that should trigger a silent reset
    const errorCode = error.status || error.code;
    const errorMessage = error.message || "";

    const shouldSilentReset =
      [
        400, // INVALID_ARGUMENT or FAILED_PRECONDITION
        403, // PERMISSION_DENIED
        404, // NOT_FOUND
        429, // RESOURCE_EXHAUSTED
        500, // INTERNAL
        503, // UNAVAILABLE
        504, // DEADLINE_EXCEEDED
      ].includes(errorCode) ||
      errorMessage.includes("503") ||
      errorMessage.includes("Service Unavailable") ||
      errorMessage.includes("INVALID_ARGUMENT") ||
      errorMessage.includes("FAILED_PRECONDITION") ||
      errorMessage.includes("PERMISSION_DENIED") ||
      errorMessage.includes("NOT_FOUND") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("INTERNAL") ||
      errorMessage.includes("DEADLINE_EXCEEDED");

    if (shouldSilentReset) {
      console.log(
        `Gemini API error (${errorCode}): ${errorMessage} - triggering frontend reset`
      );
      throw new Error("GEMINI_API_ERROR");
    }

    // Check if this is a MAX_RETRIES_REACHED error and re-throw it
    if (errorMessage === "MAX_RETRIES_REACHED") {
      throw error;
    }

    // For unexpected errors, log and retry
    console.log(
      "Unexpected Gemini API error, retrying:",
      errorMessage || error
    );
    return await generate_question(start_question, retryCount + 1);
  }
}
