/** Minimal shape of a multer file; `@types/multer` is not installed on purpose. */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
