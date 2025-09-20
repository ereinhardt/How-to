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
  **TASK**: Create a chain of 50 "How to" questions starting from the initial question, with each question naturally transitioning to the next topic while maintaining a balance between hard skills (technical) and soft skills (interpersonal/personal development).

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
  - For question 1: Find a matching video title for "How to fold?" in 'question_index.csv' and provide only the 'video_id_1'
  - For questions 2-50: Select appropriate video titles and IDs from the dataset that match your question chain

  **OUTPUT FORMAT**: Provide exactly 50 questions in the following valid JSON structure. Return only the JSON structure with no additional text, explanations, or formatting:

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

export default async function generate_question(start_question: string) {
  const video_folder = save_accesing_env_field("VIDEOS_PATH");
  const api_key = save_accesing_env_field("GEMINI_API_KEY");

  const model = "gemini-2.5-flash";

  const users_questions_path = p.join(
    __dirname,
    "../../",
    video_folder,
    "question_index.csv"
  );

  const users_csv = readFileSync(users_questions_path, { encoding: "utf8" });
  const ai = new GoogleGenAI({ apiKey: api_key });

  const cache = await ai.caches.create({
    model: model,
    config: {
      contents: users_csv,
    },
    ttlSeconds: 60, // Minimum TTL - expires after 1 minute
  });

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
    return await generate_question(start_question);
  }

  const parsed_response = parse_ai_response(response.text);

  if (!parsed_response) {
    console.log("unvalid parsed_response");
    return await generate_question(start_question);
  }

  if (!check_if_ids_exists(parsed_response, users_csv)) {
    console.log("found a Undefined id");
    return await generate_question(start_question);
  }

  return parsed_response;
}
