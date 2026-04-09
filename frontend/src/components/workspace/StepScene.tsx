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

const timeOfDayOptions = [
  { value: 'morning（早上）', label: '早上' },
  { value: 'noon（中午）', label: '中午' },
  { value: 'evening（傍晚）', label: '傍晚' },
  { value: 'night（晚上）', label: '晚上' },
];

const lightingOptions = [
  { value: '全局光', label: '全局光' },
  { value: '窗边自然光', label: '窗边自然光' },
  { value: '室内自然光', label: '室内自然光' },
  { value: '明亮柔和日光', label: '明亮柔和日光' },
  { value: '均匀日光', label: '均匀日光' },
  { value: '通透日光', label: '通透日光' },
  { value: '软光照明', label: '软光照明' },
  { value: '无硬阴影', label: '无硬阴影' },
  { value: '黄昏柔光', label: '黄昏柔光' },
  { value: 'golden hour（黄金小时光）', label: 'Golden Hour 黄金小时光' },
  { value: '暖调柔光', label: '暖调柔光' },
  { value: '低角度柔和光', label: '低角度柔和光' },
  { value: '日落柔光', label: '日落柔光' },
  { value: '室内柔和顶灯', label: '室内柔和顶灯' },
  { value: '室内均匀光', label: '室内均匀光' },
  { value: '室内柔和照明', label: '室内柔和照明' },
  { value: '室内暖白光', label: '室内暖白光' },
  { value: '室内客厅自然光', label: '室内客厅自然光' },
  { value: '室内卧室柔和光', label: '室内卧室柔和光' },
];

const compositionOptions = [
  { value: 'half-body（半身）', label: '半身' },
  { value: 'full-body（全身）', label: '全身' },
];

const depthOfFieldOptions = [
  { value: 'shallow', label: '浅景深（背景虚化）' },
  { value: 'deep', label: '深景深（背景清晰）' },
];

const aspectRatioOptions = [
  { value: '1:1', label: '1:1（方形）', orientation: '方形' },
  { value: '3:4', label: '3:4（竖向）', orientation: '竖向' },
  { value: '4:3', label: '4:3（横向）', orientation: '横向' },
  { value: '9:16', label: '9:16（竖向）', orientation: '竖向' },
  { value: '16:9', label: '16:9（横向）', orientation: '横向' },
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
          <button
            type="button"
            className={`btn-secondary ${value.mode === 'replace' ? 'btn' : ''}`}
            onClick={() => onChange({ ...value, mode: 'replace' })}
            style={{ flex: 1 }}
          >
            替换模式
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
          <span className="helper-text">上传一张场景图，AI 将参考其背景风格</span>
        </div>
      )}

      {value.mode === 'replace' && (
        <div style={{ marginBottom: '20px' }}>
          <ImageUploader
            label="参考图片"
            value={value.imageUrl}
            onChange={(imageUrl) => onChange({ ...value, imageUrl })}
          />
          <span className="helper-text" style={{ color: '#f59e0b', marginTop: '8px', display: 'block' }}>
            上传一张参考图片，AI 将保留其背景和姿势，仅替换模特和服装
          </span>
        </div>
      )}

      {value.mode === 'preset' && (
        <>
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

          <div className="field" style={{ marginBottom: '20px' }}>
            <label htmlFor="time-of-day">时段预设</label>
            <select
              id="time-of-day"
              className="select"
              value={value.timeOfDay || ''}
              onChange={(e) => onChange({ ...value, timeOfDay: e.target.value })}
            >
              <option value="">请选择时段</option>
              {timeOfDayOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="helper-text">选择拍摄时间，影响整体光线氛围</span>
          </div>

          <div className="field" style={{ marginBottom: '20px' }}>
            <label htmlFor="lighting">光照信息预设</label>
            <select
              id="lighting"
              className="select"
              value={value.lighting || ''}
              onChange={(e) => onChange({ ...value, lighting: e.target.value })}
            >
              <option value="">请选择光照类型</option>
              {lightingOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="helper-text">选择光线特征，营造不同视觉效果</span>
          </div>

          <div className="field" style={{ marginBottom: '20px' }}>
            <label htmlFor="composition">构图预设</label>
            <select
              id="composition"
              className="select"
              value={value.composition || ''}
              onChange={(e) => onChange({ ...value, composition: e.target.value })}
            >
              <option value="">请选择构图</option>
              {compositionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="helper-text">选择拍摄角度和构图方式</span>
          </div>

          <div className="field" style={{ marginBottom: '20px' }}>
            <label htmlFor="depth-of-field">景深效果</label>
            <select
              id="depth-of-field"
              className="select"
              value={value.depthOfField || ''}
              onChange={(e) => onChange({ ...value, depthOfField: e.target.value as 'shallow' | 'deep' })}
            >
              <option value="">请选择景深</option>
              {depthOfFieldOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="helper-text">浅景深=背景虚化突出主体，深景深=背景清晰细节丰富</span>
          </div>

          <div className="field" style={{ marginBottom: '20px' }}>
            <label htmlFor="aspect-ratio">尺寸比例</label>
            <select
              id="aspect-ratio"
              className="select"
              value={value.aspectRatio || ''}
              onChange={(e) =>
                onChange({ ...value, aspectRatio: e.target.value as '1:1' | '3:4' | '4:3' | '9:16' | '16:9' })
              }
            >
              <option value="">请选择尺寸比例</option>
              {aspectRatioOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="helper-text">选择图片的宽高比例，竖向适合人像，横向适合场景</span>
          </div>
        </>
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
