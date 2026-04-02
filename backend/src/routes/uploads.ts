import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config';
import { toPublicFileUrl } from '../utils/files';
import { isAllowedImageExtension, isAllowedImageMimeType } from '../utils/validators';

const router = Router();
const invalidImageMessage = '仅支持 PNG、JPG、JPEG、WEBP、GIF、SVG 图片';

const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.png';
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxUploadSizeBytes,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedImageMimeType(file.mimetype) || !isAllowedImageExtension(file.originalname)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
      return;
    }

    callback(null, true);
  },
});

const handleSingleUpload = upload.single('image');

router.post('/image', (req, res) => {
  handleSingleUpload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ message: `图片大小不能超过 ${config.maxUploadSizeMb}MB` });
        return;
      }

      res.status(400).json({ message: invalidImageMessage });
      return;
    }

    if (error) {
      res.status(500).json({ message: '图片上传失败，请稍后重试' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: '请上传图片文件' });
      return;
    }

    res.status(201).json({
      url: toPublicFileUrl(`uploads/${req.file.filename}`, req),
      filename: req.file.filename,
    });
  });
});

export default router;
