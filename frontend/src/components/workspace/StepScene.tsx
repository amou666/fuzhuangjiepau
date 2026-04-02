import type { SceneConfig } from '../../types';
import { ImageUploader } from '../common/ImageUploader';

interface StepSceneProps {
  value: SceneConfig;
  onChange: (next: SceneConfig) => void;
}

const presetOptions = [
  { value: 'city street（城市街道）' },
  { value: 'modern mall（现代商场）' },
  { value: 'cafe corner（咖啡厅角落）' },
  { value: 'natural outdoor（自然外景）' },
  { value: 'beach seaside（海滨沙滩）' },
  { value: 'urban park（城市公园）' },
  { value: 'art district（艺术街区）' },
  { value: 'industrial warehouse（工业风仓库）' },
  { value: 'vintage street（复古街道）' },
  { value: 'neon night scene（霓虹夜景）' },
  { value: 'office building lobby（写字楼大堂）' },
  { value: 'shopping center escalator（购物中心扶梯）' },
  { value: 'flower shop entrance（花店门口）' },
  { value: 'bookstore corner（书店角落）' },
  { value: 'rooftop terrace（屋顶天台）' },
  { value: 'graffiti wall（涂鸦墙）' },
  { value: 'japanese alley（日式小巷）' },
  { value: 'european architecture（欧式建筑）' },
  { value: 'subway station（地铁站）' },
  { value: 'city bridge（城市桥梁）' },
];

export function StepScene({ value, onChange }: StepSceneProps) {
  return (
    <>
      <div className="workspace-panel-header">
        <h3 className="workspace-panel-title">场景配置</h3>
        <p className="workspace-panel-subtitle">
          选择街拍场景预设，或上传真实场景图作为背景参考
        </p>
      </div>

      <div className="field" style={{ marginBottom: '20px' }}>
        <label>场景模式</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn-secondary ${value.mode === 'preset' ? 'btn' : ''}`}
            onClick={() => onChange({ ...value, mode: 'preset' })}
            style={{ flex: 1 }}
          >
            预设场景
          </button>
          <button
            type="button"
            className={`btn-secondary ${value.mode === 'upload' ? 'btn' : ''}`}
            onClick={() => onChange({ ...value, mode: 'upload' })}
            style={{ flex: 1 }}
          >
            上传场景图
          </button>
        </div>
      </div>

      {value.mode === 'upload' && (
        <div style={{ marginBottom: '20px' }}>
          <ImageUploader
            label="场景参考图"
            value={value.imageUrl}
            onChange={(imageUrl) => onChange({ ...value, imageUrl })}
          />
        </div>
      )}

      {value.mode === 'preset' && (
        <div className="field" style={{ marginBottom: '20px' }}>
          <label htmlFor="scene-preset">场景预设</label>
          <select
            id="scene-preset"
            className="select"
            value={value.preset}
            onChange={(e) => onChange({ ...value, preset: e.target.value })}
          >
            {presetOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor="scene-prompt">补充提示词</label>
        <textarea
          id="scene-prompt"
          className="textarea"
          value={value.prompt}
          onChange={(e) => onChange({ ...value, prompt: e.target.value })}
          placeholder="例如：傍晚霓虹、橱窗反射、轻微风感、杂志大片氛围"
          rows={4}
        />
        <span className="helper-text">可选，添加更多细节描述以优化生成效果</span>
      </div>
    </>
  );
}
