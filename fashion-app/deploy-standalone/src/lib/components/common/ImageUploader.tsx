import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { workspaceApi } from '@/lib/api/workspace';
import { getImageUploadError } from '@/lib/utils/validation';
import { Camera, X, Plus } from 'lucide-react';

const ACCEPT_STRING = 'image/png,image/jpeg,image/webp,image/gif';

interface ImageUploaderProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  helperText?: string;
  compact?: boolean;
}

export function ImageUploader({ label, value, onChange, helperText, compact }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const validationError = getImageUploadError(file);
    if (validationError) {
      setError(validationError);
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
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    await processFile(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleRemove = () => {
    onChange('');
    setError('');
  };

  /* ====== Has Image ====== */
  if (value) {
    return (
      <div className="flex flex-col gap-1">
        <div className="relative rounded-2xl overflow-hidden border border-[rgba(139,115,85,0.18)] bg-[rgba(139,115,85,0.02)] p-2">
          <img
            src={value}
            alt={label}
            className={compact ? 'w-full h-full object-contain block' : 'max-w-full max-h-[280px] object-contain block mx-auto'}
            style={{ transition: 'transform 0.4s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          />
          <button
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center border-none cursor-pointer transition-all duration-200"
            style={{ background: 'rgba(196,112,112,0.9)', color: '#fff' }}
            onClick={handleRemove}
            type="button"
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {helperText && <span className="text-[11px] text-[#c9bfb5] leading-relaxed">{helperText}</span>}
      </div>
    );
  }

  /* ====== Compact Empty ====== */
  if (compact) {
    return (
      <>
        <div
          className="w-full h-full flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all duration-200"
          style={{
            background: isDragging ? 'rgba(198,123,92,0.06)' : 'rgba(139,115,85,0.02)',
            border: isDragging ? '1.5px dashed rgba(198,123,92,0.5)' : '1.5px dashed rgba(139,115,85,0.25)',
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onMouseEnter={(e) => {
            if (!isDragging) {
              e.currentTarget.style.borderColor = 'rgba(198,123,92,0.4)';
              e.currentTarget.style.background = 'rgba(198,123,92,0.04)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDragging) {
              e.currentTarget.style.borderColor = 'rgba(139,115,85,0.25)';
              e.currentTarget.style.background = 'rgba(139,115,85,0.02)';
            }
          }}
        >
          {uploading ? (
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }}
            />
          ) : (
            <Plus className="w-5 h-5 text-[#c9bfb5]" />
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          onChange={handleFileChange}
          className="hidden"
        />

        {error && <div className="text-[#c47070] text-[11px] font-medium mt-0.5">{error}</div>}
      </>
    );
  }

  /* ====== Full Empty ====== */
  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex flex-col items-center justify-center py-5 md:py-8 px-4 md:px-5 rounded-2xl cursor-pointer transition-all duration-200 text-center min-h-[150px] md:min-h-[220px]"
        style={{
          background: isDragging ? 'rgba(198,123,92,0.06)' : 'rgba(139,115,85,0.02)',
          border: isDragging ? '1.5px dashed rgba(198,123,92,0.5)' : '1.5px dashed rgba(139,115,85,0.25)',
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.borderColor = 'rgba(198,123,92,0.4)';
            e.currentTarget.style.background = 'rgba(198,123,92,0.04)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.borderColor = 'rgba(139,115,85,0.25)';
            e.currentTarget.style.background = 'rgba(139,115,85,0.02)';
          }
        }}
      >
        <div className="mb-4">
          {uploading ? (
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin mx-auto"
              style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: 'rgba(198,123,92,0.08)' }}
            >
              <Camera className="w-5 h-5 text-[#c67b5c]" />
            </div>
          )}
        </div>
        <div className="text-[13px] font-semibold text-[#8b7355] mb-1">
          {uploading ? '上传中...' : isDragging ? '松开即可上传' : '点击或拖拽上传图片'}
        </div>
        <div className="text-[11px] text-[#c9bfb5]">
          {helperText || '支持 PNG / JPG / WEBP / GIF，最大 5MB'}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <div className="text-[#c47070] text-[12px] font-medium">{error}</div>}
    </div>
  );
}
