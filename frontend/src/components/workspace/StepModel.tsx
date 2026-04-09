import type { ModelConfig } from '../../types';
import { ImageUploader } from '../common/ImageUploader';

interface StepModelProps {
  value: ModelConfig;
  onChange: (next: ModelConfig) => void;
}

const categoryOptions = [
  { value: 'normal', label: '普通女孩' },
  { value: 'supermodel', label: '时尚超模' },
];

const ageOptions = [
  { value: '18', label: '18岁' },
  { value: '20', label: '20岁' },
  { value: '25', label: '25岁' },
  { value: '30', label: '30岁' },
  { value: '35', label: '35岁' },
];

const ethnicityOptions = [
  { value: 'Chinese', label: '中国人' },
  { value: 'American', label: '美国人' },
  { value: 'British', label: '英国人' },
  { value: 'French', label: '法国人' },
  { value: 'Korean', label: '韩国人' },
  { value: 'Japanese', label: '日本人' },
  { value: 'Indian', label: '印度人' },
];

const genderOptions = [
  { value: 'female', label: '女性' },
  { value: 'male', label: '男性' },
  { value: 'androgynous', label: '中性' },
];

const skinOptions = [
  { value: 'fair', label: '白皙' },
  { value: 'natural', label: '自然肤色' },
  { value: 'deep', label: '深肤色' },
];

const bodyOptions = [
  { value: 'slim', label: '修长' },
  { value: 'athletic', label: '匀称' },
  { value: 'curvy', label: '曲线' },
];

const poseOptions = [
  { value: 'walking confidently（自信地行走）' },
  { value: 'standing with hands on hips（双手叉腰站立）' },
  { value: 'sitting elegantly（优雅地坐着）' },
  { value: 'leaning against a wall（靠墙站立）' },
  { value: 'turning around（转身）' },
  { value: 'looking over shoulder（回头凝视）' },
  { value: 'hands in pockets（双手插兜）' },
  { value: 'arms crossed（双臂交叉）' },
  { value: 'walking towards camera（朝镜头走来）' },
  { value: 'walking away from camera（背对镜头走开）' },
  { value: 'adjusting clothes（整理衣物）' },
  { value: 'holding a bag（手提包）' },
  { value: 'checking phone（看手机）' },
  { value: 'putting on sunglasses（戴墨镜）' },
  { value: 'looking at watch（看手表）' },
  { value: 'stretching arms（伸展双臂）' },
  { value: 'dancing gracefully（优雅地舞蹈）' },
  { value: 'running dynamically（动态奔跑）' },
  { value: 'jumping joyfully（欢快跳跃）' },
  { value: 'sitting on stairs（坐在台阶上）' },
  { value: 'lying on grass（躺在草地上）' },
  { value: 'kneeling down（跪下）' },
  { value: 'crouching（蹲着）' },
  { value: 'leaning forward（身体前倾）' },
  { value: 'tilting head（歪头）' },
  { value: 'raising one hand（举起一只手）' },
  { value: 'pointing somewhere（指向某处）' },
  { value: 'clapping hands（拍手）' },
  { value: 'holding coffee cup（端着咖啡杯）' },
  { value: 'tying shoelaces（系鞋带）' },
];

const expressionOptions = [
  { value: 'natural smile（自然微笑）' },
  { value: 'confident smile（自信微笑）' },
  { value: 'gentle smile（温柔微笑）' },
  { value: 'mysterious smile（神秘微笑）' },
  { value: 'playful smile（俏皮微笑）' },
  { value: 'serious expression（严肃表情）' },
  { value: 'thoughtful look（沉思表情）' },
  { value: 'surprised look（惊讶表情）' },
  { value: 'happy and joyful（开心愉悦）' },
  { value: 'calm and peaceful（平静安详）' },
  { value: 'dreamy gaze（梦幻眼神）' },
  { value: 'intense gaze（深情注视）' },
  { value: 'shy smile（害羞微笑）' },
  { value: 'laughing heartily（开怀大笑）' },
  { value: 'subtle smirk（微微撇嘴）' },
  { value: 'cool and aloof（冷酷高冷）' },
  { value: 'warm and friendly（温暖友善）' },
  { value: 'elegant composure（优雅端庄）' },
  { value: 'curious look（好奇表情）' },
  { value: 'relaxed and casual（轻松随意）' },
];

export function StepModel({ value, onChange }: StepModelProps) {
  return (
    <>
      <div className="workspace-panel-header">
        <h3 className="workspace-panel-title">模特配置</h3>
        <p className="workspace-panel-subtitle">
          可上传参考模特图，或直接通过参数生成模特形象
        </p>
      </div>

      <div className="field" style={{ marginBottom: '20px' }}>
        <label>生成模式</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn-secondary ${value.mode === 'generate' ? 'btn' : ''}`}
            onClick={() => onChange({ ...value, mode: 'generate' })}
            style={{ flex: 1 }}
          >
            参数生成
          </button>
          <button
            type="button"
            className={`btn-secondary ${value.mode === 'upload' ? 'btn' : ''}`}
            onClick={() => onChange({ ...value, mode: 'upload' })}
            style={{ flex: 1 }}
          >
            上传参考图
          </button>
        </div>
      </div>

      {value.mode === 'upload' && (
        <div style={{ marginBottom: '20px' }}>
          <ImageUploader
            label="模特参考图"
            value={value.imageUrl}
            onChange={(imageUrl) => onChange({ ...value, imageUrl })}
          />
        </div>
      )}

      <div className="workspace-form-grid">
        <div className="field">
          <label htmlFor="model-category">类别</label>
          <select
            id="model-category"
            className="select"
            value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value })}
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="helper-text">普通女孩更自然亲和，时尚超模更具专业感</span>
        </div>

        <div className="field">
          <label htmlFor="model-age">年龄</label>
          <select
            id="model-age"
            className="select"
            value={value.age}
            onChange={(e) => onChange({ ...value, age: e.target.value })}
          >
            {ageOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="model-ethnicity">人种</label>
          <select
            id="model-ethnicity"
            className="select"
            value={value.ethnicity}
            onChange={(e) => onChange({ ...value, ethnicity: e.target.value })}
          >
            {ethnicityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="model-gender">性别</label>
          <select
            id="model-gender"
            className="select"
            value={value.gender}
            onChange={(e) => onChange({ ...value, gender: e.target.value })}
          >
            {genderOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="model-skin">肤色</label>
          <select
            id="model-skin"
            className="select"
            value={value.skinTone}
            onChange={(e) => onChange({ ...value, skinTone: e.target.value })}
          >
            {skinOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="model-body">体型</label>
          <select
            id="model-body"
            className="select"
            value={value.bodyType}
            onChange={(e) => onChange({ ...value, bodyType: e.target.value })}
          >
            {bodyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="model-pose">动作/姿势</label>
          <select
            id="model-pose"
            className="select"
            value={value.pose}
            onChange={(e) => onChange({ ...value, pose: e.target.value })}
          >
            {poseOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="model-expression">表情</label>
          <select
            id="model-expression"
            className="select"
            value={value.expression}
            onChange={(e) => onChange({ ...value, expression: e.target.value })}
          >
            {expressionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
