import { useRef, useState, type ChangeEvent } from 'react';
import { workspaceApi } from '@/lib/api/workspace';
import { getImageUploadError } from '@/lib/utils/validation';

interface ImageUploaderProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  helperText?: string;
}

export function ImageUploader({ label, value, onChange, helperText }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const validationError = getImageUploadError(file);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

    setUploading(true);
    setError('');

    try {
      const url = await workspaceApi.uploadImage(file);
      onChange(url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemove = () => {
    onChange('');
    setError('');
  };

  if (value) {
    return (
      <div className="image-uploader">
        <div className="image-uploader-preview">
          <img src={value} alt={label} />
          <button className="image-uploader-remove" onClick={handleRemove} type="button">
            ✕
          </button>
        </div>
        {helperText && <span className="helper-text">{helperText}</span>}
      </div>
    );
  }

  return (
    <div className="image-uploader">
      <div
        className="upload-box"
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <div className="upload-box-icon">📷</div>
        <div className="upload-box-title">
          {uploading ? '上传中...' : '点击或拖拽上传图片'}
        </div>
        <div className="upload-box-hint">
          {helperText || '支持 PNG/JPG/JPEG/WEBP/GIF，单张不超过 5MB'}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
