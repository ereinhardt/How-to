# How to? (v.2.6-4-2026)

"How to?" generates a continuous tutorial video stream (approx. 7-8h) when the user enters an initial question.

by Erik Anton Reinhardt, Finn Jakob Reinhardt.<br>
[MIT License]

---

**Pre-Setup (Checklist):**

1. Install Node.js.
2. Install FFMPEG.
3. Create a video data folder which is called `video-data` (If you want to achieve good results, you need a lot of video material and therefore storage space).

## Pre-Convert Filename Structure

After the Download of the raw YouTube Video rename it to following Structure:

```bash
How to XXX? (<ID>)
Example: How to fold? (ByKmsHdhra8)
```

## Tools (Order Important)

### 1. ytdl-downloader.py:<br>

Download raw YouTube videos (need to be named in the given pre-convert filename structure):

```bash
python ytdl-downloader.py
```

**Note**:

1. Get cookies in Netscape format with the following Chrome extension: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc?pli=1
2. Check back regularly for new ytdl updates.
3. The ytdl-Download-Tool was only tested on macOS.

---

### 2. Convert-Tool:<br>

Convert the raw YouTube video download into folders with m3u8-playlists and ts-stream-segments (these convert-video-folders need to be located later in the `video-data` folder):

```bash
npm i
npm run convert dir=<dirname>
Example: npm run convert dir=E:\video-data
```

---

### (Optional) Manual-Question-Index-Tool:<br>

Manually create question-index.csv for specific directory (use only if needed):

```bash
npm run create_question-index dir=<dirname>
Example: npm run create_question-index dir=E:\video-data
```

## Configuration

For the configuration, you need to create a `.env` file in the root of this software with the following fields:

```env
GEMINI_API_KEY="" // API key for Google Gemini GenAI
GEMINI_MODEL="gemini-2.5-flash" //model name for Gemini
SERVER_PORT="5001" // Port of file server, e.g., 5001
LOCALHOST="0" // Flag "1" to host on localhost, "0" to automatically use your (Server) current network IP
VIDEOS_PATH="" // e.g. "E:\video-data"
QUESTIONS_INDEX_PATH="" // e.g. "E:\video-data\question_index.csv"
SERVER_DEBUG="0" // "1" to enable console logs, "0" to disable
MAX_USERS="5" // Max number of concurrent active users/streams
MAX_AI_REQUESTS="50" // Global daily AI request limit (server time 00:00-23:59)
```

**Note**:

1. Delete all the // comments from the `.env`.
2. Manage your Google Gemini (GenAI) API Settings and Costs at: https://console.cloud.google.com

## Start (How to?) Software

```bash
npm i
npm run start_backend
```
