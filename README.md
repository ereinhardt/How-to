# How to? (v.2.8-9-2026)

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
SERVER_PORT="5001" // Port of file server, e.g., 5001
LOCALHOST="0" // Flag "1" to host on localhost, "0" to automatically use your (Server) current network IP
VIDEOS_PATH="" // e.g. "E:\video-data"
PLAYLIST_INDEX_PATH="" // e.g. "E:\video-data\playlist_index.json"
SERVER_DEBUG="0" // "1" to enable console logs, "0" to disable
MAX_USERS="5" // Max number of concurrent active users/streams
```

**Note**:

1. Delete all the // comments from the `.env`.
2. The `playlist_index.json` is created with `tools/create_playlist_index.py`; the server picks the playlist whose `initial_question` is semantically closest to the user's question.

## Embedding Model

Matching runs locally with EmbeddingGemma. On the first start the server downloads the required model files (~1.25 GB) from `onnx-community/embeddinggemma-300m-ONNX` into `models/embeddinggemma-300m` and reuses them on every following start. No manual setup is needed, but the first start requires an internet connection.

Only the fp32 files are fetched:

```
models/embeddinggemma-300m/
├── config.json
├── tokenizer.json
├── tokenizer_config.json
├── special_tokens_map.json
└── onnx/
    ├── model.onnx        (graph)
    └── model.onnx_data   (weights, ~1.2 GB)
```

Individual files are re-downloaded whenever they are missing, so a deleted or aborted download repairs itself on the next start. To prepare a machine without internet access, copy this folder over from another installation.

On every start the server embeds all `initial_question` entries of the `playlist_index.json` and only then begins to accept requests. If the model cannot be downloaded or loaded, the server exits with an error.

## Start (How to?) Software

```bash
npm i
npm run start_backend
```
