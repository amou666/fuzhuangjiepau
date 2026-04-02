import { ImageUploader } from '../common/ImageUploader';

interface StepClothingProps {
  clothingUrl: string;
  onChange: (value: string) => void;
}

export function StepClothing({ clothingUrl, onChange }: StepClothingProps) {
  return (
    <>
      <div className="workspace-panel-header">
        <h3 className="workspace-panel-title">上传服装图</h3>
        <p className="workspace-panel-subtitle">
          支持上传本地图片或直接粘贴线上图片地址
        </p>
      </div>
      <ImageUploader
        label="服装图片"
        value={clothingUrl}
        onChange={onChange}
        helperText="建议上传纯背景、裁切清晰的服装图，以获得更稳定的生成效果"
      />
    </>
  );
}
