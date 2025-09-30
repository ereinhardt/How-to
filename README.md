# How to? (v.2.0-09-2025)

"How to?" generates a continuous tutorial video stream (approx. 7-8h) when the user enters an initial question.

by Erik Anton Reinhardt, Finn Jakob Reinhardt.<br>
[MIT License]

---

**Pre-Setup (Checklist):**
1. Before using the software, install FFMPEG.
2. Create a video data folder which is called `video-data` (If you want to achieve good results, you need a lot of video material and therefore storage space).

## Pre-Convert Filename Structure

After the Download of the raw YouTube Video rename it to following Structure:
```bash
How to XXX? (<ID>)
Example: How to fold? (ByKmsHdhra8)
```

## Tools

### ytdl-Download-Tool:<br>
Download raw YouTube videos (need to be named in the given pre-convert filename structure):

```bash
python ytdl-downloader.py
```

**Note**: 
1. Get cookies in Netscape format with the following Chrome extension: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc?pli=1
2. Check back regularly for new ytdl updates.
3. The ytdl-Download-Tool was only tested on macOS.

---

### Convert-Tool:<br> 
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

1. Create a `users` folder in the root of this software.
2. Create a `user_question_index.txt` file in the root of this software.
3. For the configuration, you need to create a `.env` file in the root of this software with the following fields:

```env
GEMINI_API_KEY="" // API key for Google Gemini GenAI (current model: gemini-2.5-flash)
USER_QUESTION_INDEX="user_question_index.txt" // Path to txt file which saves all user questions
SERVER_HOST="" // Host of file server, e.g., localhost or the current IP (bc Network-DHCP) of your server
SERVER_PORT="" // Port of file server, e.g., 5001
USERS_FOLDER="users" // Path to folder which saves the user stream files based on their IDs
USER_STREAM_FILE_ENDING="_stream_file" // Extra name of user stream file, e.g., <id>USER_STREAM_FILE_ENDING.m3u8
DUMMY_ID="" // ID for DUMMY for debug (ignor)
VIDEOS_PATH="" // e.g. "E:\video-data"
DEBUG_SERVER="0" // Flag "1" or "0" to enable DEBUG
VIDEO_TS_FOLDER_NAME="ts_stream_convert"
```
**Note**: 
1. Delete all the // comments from the `.env`.
2. Manage your Google Gemini (GenAI) API Settings and Costs at: https://console.cloud.google.com

## Start (How to?) Software
```bash 
npm i
npm run start_backend
```

## Known Bugs (TODO):
- Rare parsing error with certain video IDs.
