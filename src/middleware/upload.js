import multer from 'multer';
import path from 'path';
import fs from 'fs';

const ALLOWED_TYPES = [
  // Images
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
  // Videos
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'video/x-msvideo', 'video/x-matroska',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

const ALLOWED_EXTENSIONS = [
  // Images
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  // Videos
  '.mp4', '.webm', '.ogv', '.mov', '.avi', '.mkv',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt',
  // Archives
  '.zip', '.rar', '.7z',
];

const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi',
  '.dll', '.vbs', '.jar', '.com', '.scr',
];

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '314572800', 10); // 300MB default

export const uploadDir = path.resolve(process.env.UPLOAD_PATH || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File type ${ext} is not allowed for security reasons`), false);
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File type ${ext} is not supported`), false);
  }
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error(`MIME type ${file.mimetype} is not allowed`), false);
  }

  cb(null, true);
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });
