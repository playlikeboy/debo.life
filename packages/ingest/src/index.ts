// @debo/ingest: turns files and audio into text, chunks and embeddings.
// Today it only holds file storage; parsing comes next.
export {
  createStorage,
  deleteFile,
  deleteUserFiles,
  FILES_BUCKET,
  userFolder,
  putFile,
  readFileText,
  signedFileLink,
  type Storage,
} from "./storage";
