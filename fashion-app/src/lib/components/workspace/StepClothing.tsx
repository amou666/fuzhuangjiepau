import { ImageUploader } from '@/lib/components/common/ImageUploader';
import type { ClothingLength } from '@/lib/types';
import { X } from 'lucide-react';

interface StepClothingProps {
  clothingUrl: string;
  clothingBackUrl: string;
  clothingDetailUrls: string[];
  clothingLength: ClothingLength | undefined;
  onChange: (value: string) => void;
  onBackChange: (value: string) => void;
  onDetailChange: (urls: string[]) => void;
  onClothingLengthChange: (value: ClothingLength | undefined) => void;
}

const clothingLengthOptions: { value: ClothingLength; label: string; desc: string }[] = [
  { value: 'cropped', label: '短款', desc: '腰部以上' },
  { value: 'standard', label: '标准', desc: '齐腰' },
  { value: 'hip-length', label: '盖臀', desc: '覆盖臀部' },
  { value: 'knee-length', label: '膝盖长', desc: '及膝' },
  { value: 'ankle-length', label: '脚踝长', desc: '及踝' },
];

const MAX_DETAIL_IMAGES = 4;

export function StepClothing({
  clothingUrl,
  clothingBackUrl,
  clothingDetailUrls,
  clothingLength,
  onChange,
  onBackChange,
  onDetailChange,
  onClothingLengthChange,
}: StepClothingProps) {
  const handleLengthClick = (value: ClothingLength) => {
    if (clothingLength === value) {
      onClothingLengthChange(undefined);
    } else {
      onClothingLengthChange(value);
    }
  };

  const handleRemoveDetail = (index: number) => {
    const next = clothingDetailUrls.filter((_, i) => i !== index);
    onDetailChange(next);
  };

  return (
    <>
      {/* Section Header */}
      <div className="mb-6">
        <h3 className="text-[17px] font-bold text-[#2d2422] tracking-tight">上传服装图</h3>
        <p className="hidden md:block text-[12px] text-[#9b8e82] mt-1 tracking-wide">
          上传服装主图，支持正面、背面和细节图
        </p>
      </div>

      {/* Front + Back */}
      <div className="grid grid-cols-2 gap-4">
        <div className="min-h-[220px]">
          <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase mb-2">正面 *</div>
          <ImageUploader
            label="正面图（必填）"
            value={clothingUrl}
            onChange={onChange}
            helperText="建议纯背景、裁切清晰的正面图"
          />
        </div>
        <div className="min-h-[220px]">
          <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase mb-2">背面</div>
          <ImageUploader
            label="背面图（可选）"
            value={clothingBackUrl}
            onChange={onBackChange}
            helperText="帮助 AI 更完整理解服装设计"
          />
        </div>
      </div>

      {/* Details */}
      <div className="mt-7">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">细节</div>
            <div className="text-[11px] text-[#c9bfb5] mt-0.5">领口、袖口、面料纹理等细节，最多 {MAX_DETAIL_IMAGES} 张</div>
          </div>
          {clothingDetailUrls.filter(Boolean).length > 0 && (
            <span className="text-[11px] text-[#c67b5c] font-medium">
              {clothingDetailUrls.filter(Boolean).length} / {MAX_DETAIL_IMAGES}
            </span>
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          {clothingDetailUrls.filter(Boolean).map((url) => {
            const idx = clothingDetailUrls.indexOf(url);
            return (
              <div key={idx} className="relative group w-[110px] h-[110px] rounded-2xl overflow-hidden border border-[rgba(139,115,85,0.08)] bg-[#faf7f4]">
                <img src={url} alt={`细节图${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveDetail(idx)}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[1] border-none cursor-pointer"
                  style={{ background: 'rgba(196,112,112,0.9)', color: '#fff' }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {clothingDetailUrls.filter(Boolean).length < MAX_DETAIL_IMAGES && (
            <div className="w-[110px] h-[110px]">
              <ImageUploader
                label={`细节图 ${clothingDetailUrls.filter(Boolean).length + 1}`}
                value=""
                onChange={(url) => {
                  onDetailChange([...clothingDetailUrls, url]);
                }}
                compact
              />
            </div>
          )}
        </div>
      </div>

      {/* Clothing Length */}
      <div className="mt-7">
        <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase mb-3">衣长</div>
        <div className="flex gap-2 flex-wrap">
          {clothingLengthOptions.map((opt) => {
            const isSelected = clothingLength === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className="flex-[1_1_auto] min-w-[72px] text-center px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 border cursor-pointer"
                style={isSelected ? {
                  background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
                  color: '#fff',
                  borderColor: 'transparent',
                  boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
                } : {
                  background: 'rgba(139,115,85,0.03)',
                  color: '#8b7355',
                  borderColor: 'rgba(139,115,85,0.08)',
                }}
                onClick={() => handleLengthClick(opt.value)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'rgba(198,123,92,0.2)';
                    e.currentTarget.style.color = '#c67b5c';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'rgba(139,115,85,0.08)';
                    e.currentTarget.style.color = '#8b7355';
                  }
                }}
              >
                <div>{opt.label}</div>
                <div className="text-[10px] mt-0.5" style={{ opacity: isSelected ? 0.8 : 0.6 }}>{opt.desc}</div>
              </button>
            );
          })}
        </div>
        <div className="text-[11px] text-[#c9bfb5] mt-2 leading-relaxed">选择衣长类型帮助 AI 理解服装比例，点击已选中项可取消</div>
      </div>
    </>
  );
}
