# How to? (v.2.0-09-2025)

by Erik Anton Reinhardt, Finn Jakob Reinhardt.

**Pre-Setup (Checklist)**

1. Before using the software, install FFMPEG!
2. Create a video data folder which is called `video-data` (you need a lot of storage).

## Filename Structure Before Convert

Example: How to fold? (ByKmsHdhra8)
```bash
How to XXX? (<ID>)
```

## Tools


1. **ytdl-Download-Tool**: Download raw YouTube videos (need to be named in the given pre-convert structure):

```bash
python ytdl-downloader.py
```

**Note**: Get cookies in Netscape format with the following Chrome extension: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc?pli=1

2. **Convert-Tool**: Convert the raw YouTube video downlaod into folders with m3u8-playlists and ts-stream-seqments (these video-folders need to be located in the `video-data` folder:

```bash
npm i
npm run convert dir=<dirname>
```

3. **Manual-Question-Index-Tool**: Create manually question-index.csv for specific directory:

```bash
npm run create_question-index dir=<dirname>
```

## Configuration

1. Create a `users` folder in the root of this software.
2. Create a `user_question_index.txt` file in the root of this software.
3. For the configuration, you need to create a `.env` file with the following fields:

```env
GEMINI_API_KEY=<> // API key for Google Gemini AI API (model: gemini-2.5-flash)
USER_QUESTION_INDEX="user_question_index.txt" // Path to txt file which saves all user questions
SERVER_HOST=<> // Host of file server, e.g., localhost or the IP of your computer
SERVER_PORT=<> // Port of file server, e.g., 5001
USERS_FOLDER="users" // Path to folder which saves the user stream files based on their IDs
USER_STREAM_FILE_ENDING="_stream_file" // Extra name of user stream file, e.g., <id>USER_STREAM_FILE_ENDING.m3u8
DUMMY_ID="" // ID for DUMMY for debug
VIDEOS_PATH=<> // e.g., "E:\video-data"
DEBUG_SERVER="0" // Flag "1" or "0" to enable DEBUG
VIDEO_TS_FOLDER_NAME="ts_stream_convert"
```

## Start Software
```bash 
npm i
npm run start_backend
```

