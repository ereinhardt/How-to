"""
A standalone script that asks for a "How to" question in the terminal,
generates and verifies the question chain exactly like the software does
(ai/ai.ts: identical prompt, identical validation) and appends the verified
result as a separate playlist to `video-data/playlist_index.json`.

On start the script creates its own virtual environment in `tools/.venv`,
installs the required packages and restarts itself inside that environment.

Usage:
    python3 tools/create_playlist_index.py
"""

import json
import os
import re
import subprocess
import sys
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "video-data" / "playlist_index.json"
DEFAULT_QUESTION_INDEX_PATH = REPO_ROOT / "video-data" / "question_index.csv"

# secret - keep this file out of version control
GEMINI_API_KEY = ""
GEMINI_MODEL = "gemini-3.8-flash"
# One (seed, temperature) pair per retry attempt
ATTEMPTS = [(42, 0), (43, 0.4), (44, 0.8)]

VENV_DIR = Path(__file__).resolve().parent / ".venv"
DEPENDENCIES = ["google-genai"]
IMPORT_CHECK = "import google.genai"
BOOTSTRAP_FLAG = "PLAYLIST_INDEX_VENV"


def venv_python_path() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


# Create the venv, install dependencies and re-run this script inside it
def ensure_environment() -> None:
    if os.environ.get(BOOTSTRAP_FLAG) == "1":
        return

    python = venv_python_path()

    if not python.exists():
        print(f"Creating virtual environment in {VENV_DIR} ...")
        subprocess.run(
            [sys.executable, "-m", "venv", str(VENV_DIR)],
            check=True,
        )

    dependencies_missing = subprocess.run(
        [str(python), "-c", IMPORT_CHECK],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode

    if dependencies_missing:
        print(f"Installing dependencies: {', '.join(DEPENDENCIES)} ...")
        subprocess.run(
            [str(python), "-m", "pip", "install", "--quiet", "--upgrade", "pip"],
            check=True,
        )
        subprocess.run(
            [str(python), "-m", "pip", "install", "--quiet", *DEPENDENCIES],
            check=True,
        )

    os.environ[BOOTSTRAP_FLAG] = "1"
    os.execv(str(python), [str(python), str(Path(__file__).resolve()), *sys.argv[1:]])


ensure_environment()

from google import genai  # noqa: E402
from google.genai import types  # noqa: E402


# Debug logging - only logs when SERVER_DEBUG=1
def debug_log(*args) -> None:
    if os.environ.get("SERVER_DEBUG") == "1":
        timestamp = datetime.now().isoformat(sep=" ", timespec="milliseconds")
        print(f"[{timestamp}]", *args)


# Ask for the question_index.csv until an existing file is given
def ask_question_index_path() -> Path:
    while True:
        raw = input(f"question_index.csv [{DEFAULT_QUESTION_INDEX_PATH}]: ").strip()
        raw = raw.strip('"').strip("'")

        path = Path(raw).expanduser() if raw else DEFAULT_QUESTION_INDEX_PATH

        if path.is_dir():
            path = path / "question_index.csv"

        if path.is_file():
            return path.resolve()

        print(f"Not found: {path}\n")


def get_question_index_csv(questions_index_path: Path) -> str:
    return questions_index_path.read_text(encoding="utf8")


# Generate AI prompt for creating a chain of "How to" questions
def generate_prompt(initial_question: str) -> str:
    prompt_template = """
  **TASK**: 
  Create a chain of 50 "How to" questions starting from the initial question, with each question naturally transitioning to the next topic while maintaining a balance between hard skills (technical) and soft skills (interpersonal/personal development).

  **REQUIREMENTS**:
  1. **Question Chain**: Start with "${initial_question}?" and create 49 additional questions
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
    
  """

    return prompt_template.replace("${initial_question}", initial_question)


# Parse JSON response from AI markdown string
def parse_ai_response(json_markdown_string: str):
    match = re.search(r"\[[\s\S]*]", json_markdown_string)

    if not match:
        return None

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


# Validate video IDs exist and are unique in CSV data, returns the reason on failure
def find_id_validation_error(response_json, csv: str) -> Optional[str]:
    i = 1
    used_video_ids = set()

    for q in response_json:
        video_id = q.get(f"video_id_{i}")
        video_title = q.get(f"video_title_{i}")

        if not video_id or video_id.strip() == "":
            return f"Video {i} has no ID or empty ID"

        if not video_title or video_title.strip() == "":
            return f"Video {i} has no title or empty title"

        if video_id in used_video_ids:
            return f"Video ID {video_id} is used more than once in the list"

        if video_id not in csv:
            return f"Video ID {video_id} not found in CSV"

        used_video_ids.add(video_id)
        i += 1

    return None


# Generate a question chain using AI (single attempt for one seed)
def generate_question(
    start_question: str, questions_index_path: Path, seed: int, temperature: float
):
    start_question = re.sub(r"[^A-Za-z0-9 _-]", "", start_question)

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set in this script!")

    if not GEMINI_MODEL:
        raise RuntimeError("GEMINI_MODEL is not set in this script!")

    api_key = GEMINI_API_KEY
    model = GEMINI_MODEL

    users_csv = get_question_index_csv(questions_index_path)
    ai = genai.Client(api_key=api_key)

    cache = None
    try:
        cache = ai.caches.create(
            model=model,
            config=types.CreateCachedContentConfig(
                contents=users_csv,
                ttl="60.0s",
            ),
        )

        debug_log("AI Request for: " + start_question)
        response = ai.models.generate_content(
            model=model,
            contents=generate_prompt(start_question),
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                cached_content=cache.name,
                seed=seed,
                temperature=temperature,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(
                    disable=True
                ),
            ),
        )

        if not response.text:
            raise RuntimeError("got no response text!")

        parsed_response = parse_ai_response(response.text)

        if not parsed_response:
            raise RuntimeError("unvalid parsed_response")

        validation_error = find_id_validation_error(parsed_response, users_csv)

        if validation_error:
            raise RuntimeError(f"validation failed: {validation_error}")

        return parsed_response
    except Exception as error:
        debug_log("Gemini API error:", error)
        raise RuntimeError(f"AI_API_ERROR: {type(error).__name__}: {error}") from error
    finally:
        if cache is not None and cache.name:
            try:
                ai.caches.delete(name=cache.name)
                debug_log("Delete Cache!")
            except Exception:
                pass


# Retry with a different seed and a higher temperature, because temperature 0 makes a repeat deterministic
def generate_question_with_retries(start_question: str, questions_index_path: Path):
    last_error = None

    for attempt, (seed, temperature) in enumerate(ATTEMPTS, start=1):
        print(
            f"Attempt {attempt}/{len(ATTEMPTS)} (seed {seed}, temperature {temperature}) ..."
        )

        try:
            return generate_question(
                start_question, questions_index_path, seed, temperature
            )
        except Exception as error:
            last_error = error
            print(f"Attempt {attempt}/{len(ATTEMPTS)} failed: {error}")

    raise last_error


# Read existing playlists or start with an empty list
def read_existing_playlists() -> list:
    if not OUTPUT_PATH.exists():
        return []

    content = OUTPUT_PATH.read_text(encoding="utf8").strip()

    if not content:
        return []

    playlists = json.loads(content)

    if not isinstance(playlists, list):
        raise RuntimeError(
            f"{OUTPUT_PATH} does not contain a JSON array - aborting to avoid data loss."
        )

    return playlists


# Append a verified playlist as a new element to playlist_index.json
def append_playlist(playlist: list) -> int:
    playlists = read_existing_playlists()

    playlists.append(
        {
            "initial_question": playlist[0]["video_title_1"],
            "playlist": playlist,
        }
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(playlists, indent=2, ensure_ascii=False), encoding="utf8"
    )

    return len(playlists)


def main() -> None:
    # every question must be typed manually - no piped/batch input
    if not sys.stdin.isatty():
        raise RuntimeError(
            "Interactive terminal required - piped or redirected input is not allowed."
        )

    print(f"Playlist index: {OUTPUT_PATH}")

    try:
        questions_index_path = ask_question_index_path()
    except (EOFError, KeyboardInterrupt):
        print()
        return

    print(f"Question index: {questions_index_path}")
    print('Enter a "How to" question (empty input or "exit" to quit).\n')

    while True:
        try:
            answer = input("Question: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if answer == "" or answer.lower() == "exit":
            break

        print("Generating and verifying question chain ...")

        try:
            questions = generate_question_with_retries(answer, questions_index_path)
            total = append_playlist(questions)
            print(
                f"Verified. {len(questions)} questions saved as playlist #{total}.\n"
            )
        except Exception as error:
            print(f"Failed: {error}")
            traceback.print_exc()
            print()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Error: {error}")
        sys.exit(1)
