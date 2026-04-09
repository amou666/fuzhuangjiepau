import { ImageUploader } from '@/lib/components/common/ImageUploader';
import type { ClothingLength } from '@/lib/types';

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

  const handleAddDetail = () => {
    if (clothingDetailUrls.length < MAX_DETAIL_IMAGES) {
      onDetailChange([...clothingDetailUrls, '']);
    }
  };

  const handleDetailChange = (index: number, url: string) => {
    const next = [...clothingDetailUrls];
    next[index] = url;
    onDetailChange(next);
  };

  const handleRemoveDetail = (index: number) => {
    const next = clothingDetailUrls.filter((_, i) => i !== index);
    onDetailChange(next);
  };

  return (
    <>
      <div className="workspace-panel-header">
        <h3 className="workspace-panel-title">上传服装图</h3>
        <p className="workspace-panel-subtitle">
          上传本地服装图片，支持正面图、背面图和细节图
        </p>
      </div>

      <ImageUploader
        label="正面图（必填）"
        value={clothingUrl}
        onChange={onChange}
        helperText="建议上传纯背景、裁切清晰的服装正面图，以获得更稳定的生成效果"
      />

      <div style={{ marginTop: '20px' }}>
        <ImageUploader
          label="背面图（可选）"
          value={clothingBackUrl}
          onChange={onBackChange}
          helperText="上传服装背面图，帮助 AI 更完整地理解服装设计"
        />
      </div>

      <div className="field" style={{ marginTop: '20px' }}>
        <label>
          细节图 <span style={{ fontWeight: 'normal', opacity: 0.6 }}>（可选，最多 {MAX_DETAIL_IMAGES} 张）</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clothingDetailUrls.map((url, index) => (
            <div key={index} style={{ position: 'relative' }}>
              <ImageUploader
                label={`细节图 ${index + 1}`}
                value={url}
                onChange={(newUrl) => handleDetailChange(index, newUrl)}
                helperText="上传领口、袖口、面料纹理、纽扣等细节特写"
              />
              {url && (
                <button
                  type="button"
                  onClick={() => handleRemoveDetail(index)}
                  style={{
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '22px',
                    height: '22px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                  }}
                  title="移除此细节图"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {clothingDetailUrls.length < MAX_DETAIL_IMAGES && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleAddDetail}
            style={{ marginTop: '10px', width: '100%' }}
          >
            + 添加细节图
          </button>
        )}
      </div>

      <div className="field" style={{ marginTop: '20px' }}>
        <label>衣长分类 <span style={{ fontWeight: 'normal', opacity: 0.6 }}>（可选）</span></label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {clothingLengthOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={clothingLength === opt.value ? 'btn' : 'btn-secondary'}
              onClick={() => handleLengthClick(opt.value)}
              style={{ flex: '1 1 auto', minWidth: '80px', textAlign: 'center' }}
            >
              <div>{opt.label}</div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>{opt.desc}</div>
            </button>
          ))}
        </div>
        <span className="helper-text">选择服装的衣长类型，帮助 AI 更准确地理解服装比例。默认不选择，点击已选中项可取消</span>
      </div>
    </>
  );
}
