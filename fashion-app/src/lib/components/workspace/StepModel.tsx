import type { ModelConfig } from '@/lib/types';
import { ImageUploader } from '@/lib/components/common/ImageUploader';
import { Upload, Settings2 } from 'lucide-react';

interface StepModelProps {
  value: ModelConfig;
  onChange: (next: ModelConfig) => void;
  sceneMode?: 'preset' | 'replace';
}

const categoryOptions = [
  { value: 'normal', label: '普通女孩' },
  { value: 'supermodel', label: '时尚超模' },
  { value: 'kardashian', label: '卡戴珊风格' },
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

const faceFeatureOptions = [
  { value: '', label: '无（自由发挥）' },
  { value: 'American makeup style with contoured cheekbones, bold brows, nude or red lips, highlighted nose bridge, full coverage matte foundation（美式妆造）', label: '美式妆造' },
  { value: 'Korean makeup style with gradient lips, straight brows, dewy glass skin, subtle eyeliner, natural flush cheeks（韩式妆造）', label: '韩式妆造' },
  { value: 'light natural freckles across nose and cheeks, sun-kissed fresh face, minimal makeup（轻微雀斑）', label: '轻微雀斑' },
];

const poseOptions = [
  { value: '', label: '无（自由发挥）' },
  { value: 'walking confidently（自信地行走）', label: '自信地行走' },
  { value: 'standing with hands on hips（双手叉腰站立）', label: '双手叉腰站立' },
  { value: 'sitting elegantly（优雅地坐着）', label: '优雅地坐着' },
  { value: 'leaning against a wall（靠墙站立）', label: '靠墙站立' },
  { value: 'turning around（转身）', label: '转身' },
  { value: 'looking over shoulder（回头凝视）', label: '回头凝视' },
  { value: 'hands in pockets（双手插兜）', label: '双手插兜' },
  { value: 'arms crossed（双臂交叉）', label: '双臂交叉' },
  { value: 'walking towards camera（朝镜头走来）', label: '朝镜头走来' },
  { value: 'walking away from camera（背对镜头走开）', label: '背对镜头走开' },
  { value: 'adjusting clothes（整理衣物）', label: '整理衣物' },
  { value: 'holding a bag（手提包）', label: '手提包' },
  { value: 'checking phone（看手机）', label: '看手机' },
  { value: 'putting on sunglasses（戴墨镜）', label: '戴墨镜' },
  { value: 'looking at watch（看手表）', label: '看手表' },
  { value: 'stretching arms（伸展双臂）', label: '伸展双臂' },
  { value: 'dancing gracefully（优雅地舞蹈）', label: '优雅地舞蹈' },
  { value: 'running dynamically（动态奔跑）', label: '动态奔跑' },
  { value: 'jumping joyfully（欢快跳跃）', label: '欢快跳跃' },
  { value: 'sitting on stairs（坐在台阶上）', label: '坐在台阶上' },
  { value: 'lying on grass（躺在草地上）', label: '躺在草地上' },
  { value: 'kneeling down（跪下）', label: '跪下' },
  { value: 'crouching（蹲着）', label: '蹲着' },
  { value: 'leaning forward（身体前倾）', label: '身体前倾' },
  { value: 'tilting head（歪头）', label: '歪头' },
  { value: 'raising one hand（举起一只手）', label: '举起一只手' },
  { value: 'pointing somewhere（指向某处）', label: '指向某处' },
  { value: 'clapping hands（拍手）', label: '拍手' },
  { value: 'holding coffee cup（端着咖啡杯）', label: '端着咖啡杯' },
  { value: 'tying shoelaces（系鞋带）', label: '系鞋带' },
  { value: 'power pose with legs apart（棚拍分腿力量站姿）', label: '棚拍分腿力量站姿' },
  { value: 'hand on waist chin up（棚拍叉腰仰头）', label: '棚拍叉腰仰头' },
  { value: 'sitting on stool legs crossed（棚拍坐凳翘腿）', label: '棚拍坐凳翘腿' },
  { value: 'one arm raised behind head（棚拍单臂举过头顶）', label: '棚拍单臂举过头顶' },
  { value: 'dramatic lean on prop table（棚拍斜靠道具桌）', label: '棚拍斜靠道具桌' },
  { value: 'profile pose looking away（棚拍侧脸凝视远方）', label: '棚拍侧脸凝视远方' },
  { value: 'high fashion hand near face（棚拍手部靠近面部）', label: '棚拍手部靠近面部' },
  { value: 'contrapposto with hand in hair（棚拍对位站姿手撩发）', label: '棚拍对位站姿手撩发' },
  { value: 'kneeling on one knee arm extended（棚拍单膝跪地手臂伸展）', label: '棚拍单膝跪地手臂伸展' },
  { value: 'back-to-camera over shoulder glance（棚拍背对镜头回眸）', label: '棚拍背对镜头回眸' },
];

const expressionOptions = [
  { value: '', label: '无（自由发挥）' },
  { value: 'natural smile（自然微笑）', label: '自然微笑' },
  { value: 'confident smile（自信微笑）', label: '自信微笑' },
  { value: 'gentle smile（温柔微笑）', label: '温柔微笑' },
  { value: 'mysterious smile（神秘微笑）', label: '神秘微笑' },
  { value: 'playful smile（俏皮微笑）', label: '俏皮微笑' },
  { value: 'serious expression（严肃表情）', label: '严肃表情' },
  { value: 'thoughtful look（沉思表情）', label: '沉思表情' },
  { value: 'surprised look（惊讶表情）', label: '惊讶表情' },
  { value: 'happy and joyful（开心愉悦）', label: '开心愉悦' },
  { value: 'calm and peaceful（平静安详）', label: '平静安详' },
  { value: 'dreamy gaze（梦幻眼神）', label: '梦幻眼神' },
  { value: 'intense gaze（深情注视）', label: '深情注视' },
  { value: 'shy smile（害羞微笑）', label: '害羞微笑' },
  { value: 'laughing heartily（开怀大笑）', label: '开怀大笑' },
  { value: 'subtle smirk（微微撇嘴）', label: '微微撇嘴' },
  { value: 'cool and aloof（冷酷高冷）', label: '冷酷高冷' },
  { value: 'warm and friendly（温暖友善）', label: '温暖友善' },
  { value: 'elegant composure（优雅端庄）', label: '优雅端庄' },
  { value: 'curious look（好奇表情）', label: '好奇表情' },
  { value: 'relaxed and casual（轻松随意）', label: '轻松随意' },
];

const selectStyle: React.CSSProperties = {
  background: 'rgba(139,115,85,0.03)',
  border: '1px solid rgba(139,115,85,0.1)',
  borderRadius: '12px',
  padding: '10px 36px 10px 14px',
  fontSize: '13px',
  color: '#2d2422',
  width: '100%',
  outline: 'none',
  transition: 'all 0.2s',
};

export function StepModel({ value, onChange, sceneMode }: StepModelProps) {
  const isReplaceMode = sceneMode === 'replace';
  return (
    <>
      <div className="mb-6">
        <h3 className="text-[17px] font-bold text-[#2d2422] tracking-tight">模特配置</h3>
        <p className="hidden md:block text-[12px] text-[#9b8e82] mt-1 tracking-wide">
          可上传参考模特图，或直接通过参数生成模特形象
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase mb-3">模式</div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 border cursor-pointer"
            style={value.mode === 'generate' ? {
              background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
              color: '#fff',
              borderColor: 'transparent',
              boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
            } : {
              background: 'rgba(139,115,85,0.03)',
              color: '#8b7355',
              borderColor: 'rgba(139,115,85,0.08)',
            }}
            onClick={() => onChange({ ...value, mode: 'generate' })}
          >
            <span className="inline-flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" /> 参数生成</span>
          </button>
          <button
            type="button"
            className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 border cursor-pointer"
            style={value.mode === 'upload' ? {
              background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
              color: '#fff',
              borderColor: 'transparent',
              boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
            } : {
              background: 'rgba(139,115,85,0.03)',
              color: '#8b7355',
              borderColor: 'rgba(139,115,85,0.08)',
            }}
            onClick={() => onChange({ ...value, mode: 'upload' })}
          >
            <span className="inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> 上传参考图</span>
          </button>
        </div>
      </div>

      {value.mode === 'upload' && (
        <div className="mb-6">
          <ImageUploader
            label="模特参考图"
            value={value.imageUrl}
            onChange={(imageUrl) => onChange({ ...value, imageUrl })}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-category" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">类别</label>
          <select id="model-category" style={selectStyle} value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value })}>
            {categoryOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <span className="text-[11px] text-[#c9bfb5] leading-relaxed">普通女孩更自然亲和，时尚超模更具专业感</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-age" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">年龄</label>
          <select id="model-age" style={selectStyle} value={value.age} onChange={(e) => onChange({ ...value, age: e.target.value })}>
            {ageOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-ethnicity" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">人种</label>
          <select id="model-ethnicity" style={selectStyle} value={value.ethnicity} onChange={(e) => onChange({ ...value, ethnicity: e.target.value })}>
            {ethnicityOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-gender" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">性别</label>
          <select id="model-gender" style={selectStyle} value={value.gender} onChange={(e) => onChange({ ...value, gender: e.target.value })}>
            {genderOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-skin" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">肤色</label>
          <select id="model-skin" style={selectStyle} value={value.skinTone} onChange={(e) => onChange({ ...value, skinTone: e.target.value })}>
            {skinOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-body" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">体型</label>
          <select id="model-body" style={selectStyle} value={value.bodyType} onChange={(e) => onChange({ ...value, bodyType: e.target.value })}>
            {bodyOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-face-feature" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">脸部特征</label>
          <select id="model-face-feature" style={selectStyle} value={value.faceFeature} onChange={(e) => onChange({ ...value, faceFeature: e.target.value })}>
            {faceFeatureOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>))}
          </select>
          <span className="text-[11px] text-[#c9bfb5] leading-relaxed">美式/韩式妆造、雀斑等面部风格</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-pose" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">动作 / 姿势</label>
          <select id="model-pose" style={{ ...selectStyle, opacity: isReplaceMode ? 0.5 : 1 }} value={value.pose} onChange={(e) => onChange({ ...value, pose: e.target.value })} disabled={isReplaceMode}>
            {poseOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>))}
          </select>
          {isReplaceMode && <span className="text-[11px] text-[#d4a06a] leading-relaxed">替换模式下姿势由参考图决定</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-expression" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">表情</label>
          <select id="model-expression" style={{ ...selectStyle, opacity: isReplaceMode ? 0.5 : 1 }} value={value.expression} onChange={(e) => onChange({ ...value, expression: e.target.value })} disabled={isReplaceMode}>
            {expressionOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>))}
          </select>
          {isReplaceMode && <span className="text-[11px] text-[#d4a06a] leading-relaxed">替换模式下表情由参考图决定</span>}
        </div>
      </div>
    </>
  );
}
