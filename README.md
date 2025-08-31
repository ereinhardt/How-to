# How To 

**FFMPEG IS MANDATORY**

## Filename-Structure before Convert

How to XXX? (<ID>) 
```bash
How to fold? (ByKmsHdhra8)
```

## Convert 

```bash
npm i
npm run build 
npm run convert dir=<dirname>
```

## Start Backend
```bash 
npm run start_backend
```


## Config 
For the config you need a .env file following fields: 

```env
GEMINI_API_KEY=<> //api key for AI
USER_QUESTION_INDEX=<> //path to txt file which saves all user questions
SERVER_HOST=<> //host of fileserver eg. localhost
SERVER_PORT=<> //port of fileserver eg. 8000
USERS_FOLDER=<> //path to folder which saves the user stream files based on their ids
USER_STREAM_FILE_ENDING=<> //extra name of user stream file eg. <id>USER_STREAM_FILE_ENDING.<m3u8>
DUMMY_ID=<> //id for DUMMY for debug 
DEBUG = <> //flag "1" or "0" to enable DEBUG
```

## Debug-Tools 

create manually question-index.csv for specific directory: 

```bash
npm run create_question-index dir=<dirname>
```
