import { useMemo, useState } from 'react';
import type { SceneConfig } from '@/lib/types';
import { SCENE_OPTIONS } from '@/lib/scene-options';
import { ImageUploader } from '@/lib/components/common/ImageUploader';
import { FavoriteBar } from './FavoriteBar';
import { Upload, Replace, AlertTriangle, ChevronDown, Settings2, MapPin, Building2, Coffee, Warehouse, TreePine, Waves, Palette, Store } from 'lucide-react';

interface StepSceneProps {
  value: SceneConfig;
  onChange: (next: SceneConfig) => void;
}

const SCENE_ICONS: Record<string, React.ReactNode> = {
  'city street（城市街道）': <Building2 className="w-4 h-4" />,
  'natural outdoor（自然外景）': <TreePine className="w-4 h-4" />,
  'beach seaside（海滨沙滩）': <Waves className="w-4 h-4" />,
  'urban park（城市公园）': <TreePine className="w-4 h-4" />,
  'vintage street（复古街道）': <MapPin className="w-4 h-4" />,
  'art district（艺术街区）': <Palette className="w-4 h-4" />,
  'graffiti wall（涂鸦墙）': <Palette className="w-4 h-4" />,
  'japanese alley（日式小巷）': <MapPin className="w-4 h-4" />,
  'european architecture（欧式建筑）': <Building2 className="w-4 h-4" />,
  'city bridge（城市桥梁）': <Building2 className="w-4 h-4" />,
  'rooftop terrace（屋顶天台）': <Building2 className="w-4 h-4" />,
  'industrial warehouse（工业风仓库）': <Warehouse className="w-4 h-4" />,
  'modern mall（现代商场）': <Store className="w-4 h-4" />,
  'cafe corner（咖啡厅角落）': <Coffee className="w-4 h-4" />,
  'office building lobby（写字楼大堂）': <Building2 className="w-4 h-4" />,
  'shopping center escalator（购物中心扶梯）': <Store className="w-4 h-4" />,
  'flower shop entrance（花店门口）': <Store className="w-4 h-4" />,
  'bookstore corner（书店角落）': <Store className="w-4 h-4" />,
  'subway station（地铁站）': <MapPin className="w-4 h-4" />,
  'photo studio（摄影棚）': <Warehouse className="w-4 h-4" />,
  'neon night scene（霓虹夜景）': <MapPin className="w-4 h-4" />,
};

const presetOptions = SCENE_OPTIONS.map(o => ({
  ...o,
  icon: SCENE_ICONS[o.value] || <MapPin className="w-4 h-4" />,
}));

const timeOfDayOptions = [
  { value: 'morning（早上）', label: '早上' },
  { value: 'noon（中午）', label: '中午' },
  { value: 'evening（傍晚）', label: '傍晚' },
  { value: 'night（晚上）', label: '晚上' },
];

const lightingOptions = [
  { value: '明亮柔和日光', label: '明亮柔和日光' },
  { value: '均匀日光', label: '均匀日光' },
  { value: '窗边自然光', label: '窗边自然光' },
  { value: '室内自然光', label: '室内自然光' },
  { value: '通透日光', label: '通透日光' },
  { value: '黄昏柔光', label: '黄昏柔光' },
  { value: 'golden hour（黄金小时光）', label: '黄金小时光' },
  { value: '暖调柔光', label: '暖调柔光' },
  { value: '低角度柔和光', label: '低角度柔和光' },
  { value: '日落柔光', label: '日落柔光' },
  { value: '室内客厅自然光', label: '室内客厅自然光' },
  { value: '室内卧室柔和光', label: '室内卧室柔和光' },
  { value: '全局光', label: '全局光' },
  { value: '软光照明', label: '软光照明' },
  { value: '无硬阴影', label: '无硬阴影' },
  { value: '室内柔和顶灯', label: '室内柔和顶灯' },
  { value: '室内均匀光', label: '室内均匀光' },
  { value: '室内柔和照明', label: '室内柔和照明' },
  { value: '室内暖白光', label: '室内暖白光' },
];

const compositionOptions = [
  { value: 'half-body（半身）', label: '半身' },
  { value: 'full-body（全身）', label: '全身' },
];

const depthOfFieldOptions = [
  { value: 'slight', label: '轻微景深' },
  { value: 'shallow', label: '浅景深（背景虚化）' },
  { value: 'deep', label: '深景深（背景清晰）' },
];

const aspectRatioOptions = [
  { value: '1:1', label: '1:1 方形' },
  { value: '3:4', label: '3:4 竖向' },
  { value: '4:3', label: '4:3 横向' },
  { value: '9:16', label: '9:16 竖向' },
  { value: '16:9', label: '16:9 横向' },
];

const grainOptions = [
  { value: 'none', label: '无噪点' },
  { value: 'light', label: '轻微噪点' },
  { value: 'heavy', label: '浓厚噪点' },
];

const exposureModeOptions = [
  { value: 'natural', label: '自然' },
  { value: 'bright', label: '偏亮' },
  { value: 'dark', label: '偏暗' },
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

const STUDIO_PRESET_VALUE = 'photo studio（摄影棚）';
const STUDIO_LIGHTING_FALLBACK = '软光照明';

export function StepScene({ value, onChange }: StepSceneProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sceneCategory, setSceneCategory] = useState<'all' | 'outdoor' | 'indoor'>('all');

  const filteredPresets = useMemo(() => {
    if (sceneCategory === 'all') return presetOptions;
    return presetOptions.filter(p => p.category === sceneCategory);
  }, [sceneCategory]);

  const selectedPreset = presetOptions.find(p => p.value === value.preset);

  const hasAdvancedValues = !!(value.timeOfDay || value.lighting || value.depthOfField || value.aspectRatio || (value.grain && value.grain !== 'none') || value.exposureMode !== 'natural');

  const conflictMsg = useMemo(() => {
    const msgs: string[] = [];
    if (selectedPreset?.conflict) msgs.push(selectedPreset.conflict);
    if (selectedPreset?.category === 'indoor' && value.lighting && ['明亮柔和日光', '均匀日光', 'golden hour（黄金小时光）', '日落柔光'].includes(value.lighting)) {
      msgs.push('当前选的是室内场景，但光照选了户外日光类型，建议换成室内光照或留空');
    }
    if (value.timeOfDay === 'night（晚上）' && selectedPreset?.category === 'outdoor' && selectedPreset.value !== 'neon night scene（霓虹夜景）') {
      msgs.push('夜间时段搭配户外场景效果较难把控，建议用傍晚代替或在补充提示词中描述光源');
    }
    return msgs;
  }, [value.lighting, value.timeOfDay, selectedPreset]);

  return (
    <>
      <div className="mb-6">
        <h3 className="text-[17px] font-bold text-[#2d2422] tracking-tight">场景配置</h3>
        <p className="hidden md:block text-[12px] text-[#9b8e82] mt-1 tracking-wide">
          选一个场景，剩下的交给 AI
        </p>
      </div>

      <FavoriteBar
        type="scene"
        currentData={value as unknown as Record<string, unknown>}
        onLoad={(data) => onChange(data as unknown as SceneConfig)}
        previewUrl={value.imageUrl}
      />

      {/* Scene Mode */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase mb-3">模式</div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 border cursor-pointer"
            style={value.mode === 'preset' ? {
              background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
              color: '#fff',
              borderColor: 'transparent',
              boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
            } : {
              background: 'rgba(139,115,85,0.03)',
              color: '#8b7355',
              borderColor: 'rgba(139,115,85,0.08)',
            }}
            onClick={() => onChange({ ...value, mode: 'preset' })}
          >
            预设模式
          </button>
          <button
            type="button"
            className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 border cursor-pointer"
            style={value.mode === 'replace' ? {
              background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
              color: '#fff',
              borderColor: 'transparent',
              boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
            } : {
              background: 'rgba(139,115,85,0.03)',
              color: '#8b7355',
              borderColor: 'rgba(139,115,85,0.08)',
            }}
            onClick={() => onChange({ ...value, mode: 'replace' })}
          >
            <span className="inline-flex items-center gap-1.5"><Replace className="w-3.5 h-3.5" /> 替换模式</span>
          </button>
        </div>
      </div>

      {value.mode === 'replace' && (
        <div className="mb-6">
          <ImageUploader
            label="参考图片"
            value={value.imageUrl}
            onChange={(imageUrl) => onChange({ ...value, imageUrl })}
          />
          <div className="flex items-start gap-1.5 mt-2.5 px-1">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#d4a06a]" />
            <span className="text-[11px] text-[#d4a06a] leading-relaxed">
              上传参考图片，AI 将保留其背景和姿势，仅替换模特和服装
            </span>
          </div>
        </div>
      )}

      {value.mode === 'preset' && (
        <>
          {/* Scene Source */}
          <div className="mb-6">
            <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase mb-3">来源</div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="flex-1 text-center px-3.5 py-2.5 rounded-[12px] text-[13px] font-medium transition-all duration-200 border cursor-pointer"
                style={value.sceneSource === 'preset' ? {
                  background: 'rgba(125,155,118,0.12)',
                  color: '#5a7a53',
                  borderColor: 'rgba(125,155,118,0.2)',
                } : {
                  background: 'rgba(139,115,85,0.03)',
                  color: '#8b7355',
                  borderColor: 'rgba(139,115,85,0.08)',
                }}
                onClick={() => onChange({ ...value, sceneSource: 'preset' })}
              >
                预设
              </button>
              <button
                type="button"
                className="flex-1 text-center px-3.5 py-2.5 rounded-[12px] text-[13px] font-medium transition-all duration-200 border cursor-pointer"
                style={value.sceneSource === 'upload' ? {
                  background: 'rgba(125,155,118,0.12)',
                  color: '#5a7a53',
                  borderColor: 'rgba(125,155,118,0.2)',
                } : {
                  background: 'rgba(139,115,85,0.03)',
                  color: '#8b7355',
                  borderColor: 'rgba(139,115,85,0.08)',
                }}
                onClick={() => onChange({ ...value, sceneSource: 'upload' })}
              >
                <span className="inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> 参考场景</span>
              </button>
            </div>
          </div>

          {value.sceneSource === 'preset' && (
            <div className="mb-6">
              {/* Category Filter */}
              <div className="flex gap-2 mb-3">
                {([
                  { key: 'all' as const, label: '全部' },
                  { key: 'outdoor' as const, label: '户外' },
                  { key: 'indoor' as const, label: '室内' },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border"
                    style={sceneCategory === tab.key ? {
                      background: 'rgba(198,123,92,0.08)',
                      color: '#c67b5c',
                      borderColor: 'rgba(198,123,92,0.2)',
                    } : {
                      background: 'transparent',
                      color: '#b0a59a',
                      borderColor: 'rgba(139,115,85,0.06)',
                    }}
                    onClick={() => setSceneCategory(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Scene Cards Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {filteredPresets.map((preset) => {
                  const isSelected = value.preset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 border cursor-pointer group"
                      style={isSelected ? {
                        background: 'rgba(198,123,92,0.08)',
                        borderColor: 'rgba(198,123,92,0.3)',
                        boxShadow: '0 2px 8px rgba(198,123,92,0.12)',
                      } : {
                        background: 'rgba(139,115,85,0.02)',
                        borderColor: 'rgba(139,115,85,0.06)',
                      }}
                      onClick={() => {
                        const isStudio = preset.value === STUDIO_PRESET_VALUE;
                        const shouldSwitchLighting =
                          isStudio &&
                          (!value.lighting || ['明亮柔和日光', '均匀日光', 'golden hour（黄金小时光）'].includes(value.lighting));
                        onChange({
                          ...value,
                          preset: preset.value,
                          lighting: shouldSwitchLighting ? STUDIO_LIGHTING_FALLBACK : value.lighting,
                        });
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                        style={{
                          background: isSelected ? 'linear-gradient(135deg, #c67b5c, #d4a882)' : 'rgba(139,115,85,0.06)',
                          color: isSelected ? '#fff' : '#b0a59a',
                        }}
                      >
                        {preset.icon}
                      </div>
                      <span className={`text-[11px] font-medium text-center leading-tight ${isSelected ? 'text-[#c67b5c]' : 'text-[#8b7355] group-hover:text-[#2d2422]'}`}>
                        {preset.label}
                      </span>
                      <span className="text-[9px] text-[#c9bfb5]">
                        {preset.category === 'outdoor' ? '户外' : '室内'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Conflict Warning */}
              {conflictMsg.length > 0 && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-[rgba(212,160,106,0.06)] border border-[rgba(212,160,106,0.15)]">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#d4a06a]" />
                  <div className="text-[11px] text-[#b8956a] leading-relaxed space-y-1">
                    {conflictMsg.map((msg, i) => <p key={i} className="m-0">{msg}</p>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {value.sceneSource === 'upload' && (
            <div className="mb-6">
              <ImageUploader
                label="场景参考图"
                value={value.imageUrl}
                onChange={(imageUrl) => onChange({ ...value, imageUrl })}
              />
              <span className="text-[11px] text-[#c9bfb5] leading-relaxed mt-1.5 block">上传一张场景图，AI 将参考其背景风格</span>
            </div>
          )}

          {/* Basic Params */}
          <div className="mb-2">
            <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase mb-3">基础参数</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-4 mb-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="composition" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">构图</label>
              <select id="composition" style={selectStyle} value={value.composition || ''} onChange={(e) => onChange({ ...value, composition: e.target.value })}>
                <option value="">自动</option>
                {compositionOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="aspect-ratio" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">比例</label>
              <select
                id="aspect-ratio"
                style={selectStyle}
                value={value.aspectRatio ?? ''}
                onChange={(e) => onChange({ ...value, aspectRatio: e.target.value ? (e.target.value as '1:1' | '3:4' | '4:3' | '9:16' | '16:9') : undefined })}
              >
                <option value="">默认 3:4</option>
                {aspectRatioOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="exposure-mode" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">曝光</label>
              <select
                id="exposure-mode"
                style={selectStyle}
                value={value.exposureMode ?? 'natural'}
                onChange={(e) => onChange({ ...value, exposureMode: e.target.value as 'natural' | 'bright' | 'dark' })}
              >
                {exposureModeOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>
          </div>

          {/* Advanced Toggle */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 py-2.5 mb-4 rounded-xl text-[12px] font-medium transition-all border cursor-pointer"
            style={{
              background: showAdvanced ? 'rgba(198,123,92,0.04)' : 'rgba(139,115,85,0.02)',
              color: showAdvanced ? '#c67b5c' : '#b0a59a',
              borderColor: showAdvanced ? 'rgba(198,123,92,0.15)' : 'rgba(139,115,85,0.06)',
            }}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings2 className="w-3.5 h-3.5" />
            高级参数 ({showAdvanced ? '收起' : '展开'})
            {hasAdvancedValues && !showAdvanced && <span className="text-[10px] text-[#7d9b76]">· 已配置</span>}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5 mb-6 p-4 rounded-2xl border border-[rgba(139,115,85,0.06)] bg-[rgba(139,115,85,0.01)]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="time-of-day" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">时段</label>
                <select id="time-of-day" style={selectStyle} value={value.timeOfDay || ''} onChange={(e) => onChange({ ...value, timeOfDay: e.target.value })}>
                  <option value="">自动</option>
                  {timeOfDayOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="lighting" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">光照</label>
                <select id="lighting" style={selectStyle} value={value.lighting || ''} onChange={(e) => onChange({ ...value, lighting: e.target.value })}>
                  <option value="">自动（推荐）</option>
                  {lightingOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="depth-of-field" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">景深</label>
                <select
                  id="depth-of-field"
                  style={selectStyle}
                  value={value.depthOfField ?? ''}
                  onChange={(e) => onChange({ ...value, depthOfField: e.target.value ? (e.target.value as 'slight' | 'shallow' | 'deep') : undefined })}
                >
                  <option value="">自动</option>
                  {depthOfFieldOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="grain" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">噪点</label>
                <select
                  id="grain"
                  style={selectStyle}
                  value={value.grain ?? ''}
                  onChange={(e) => onChange({ ...value, grain: e.target.value ? (e.target.value as 'none' | 'light' | 'heavy') : undefined })}
                >
                  <option value="">默认无</option>
                  {grainOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
              </div>
            </div>
          )}
        </>
      )}

      {/* Prompt */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="scene-prompt" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">补充提示词 <span className="text-[#c9bfb5] normal-case tracking-normal font-normal">（可选）</span></label>
        <textarea
          id="scene-prompt"
          className="w-full px-4 py-3 text-[13px] text-[#2d2422] resize-y min-h-[80px] rounded-xl outline-none transition-all duration-200"
          style={{
            background: 'rgba(139,115,85,0.03)',
            border: '1px solid rgba(139,115,85,0.1)',
          }}
          value={value.prompt}
          onChange={(e) => onChange({ ...value, prompt: e.target.value })}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(198,123,92,0.3)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(198,123,92,0.08)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(139,115,85,0.1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          placeholder="例：阴天散射光、行人略远、橱窗弱反射..."
          rows={3}
        />
      </div>
    </>
  );
}
