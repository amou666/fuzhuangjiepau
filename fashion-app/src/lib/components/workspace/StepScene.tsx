import type { SceneConfig } from '@/lib/types';
import { ImageUploader } from '@/lib/components/common/ImageUploader';
import { Upload, Replace, AlertTriangle } from 'lucide-react';

interface StepSceneProps {
  value: SceneConfig;
  onChange: (next: SceneConfig) => void;
}

/** tag：与 buildStreetFashionPrompt 里「自然街拍光 / 反霓虹 / 反棚拍」主提示的潜在冲突，仅作说明 */
const presetOptions: { value: string; label: string; tag?: string }[] = [
  { value: 'city street（城市街道）', label: '城市街道' },
  { value: 'natural outdoor（自然外景）', label: '自然外景' },
  { value: 'beach seaside（海滨沙滩）', label: '海滨沙滩' },
  { value: 'urban park（城市公园）', label: '城市公园' },
  { value: 'vintage street（复古街道）', label: '复古街道' },
  { value: 'art district（艺术街区）', label: '艺术街区' },
  { value: 'graffiti wall（涂鸦墙）', label: '涂鸦墙' },
  { value: 'japanese alley（日式小巷）', label: '日式小巷' },
  { value: 'european architecture（欧式建筑）', label: '欧式建筑' },
  { value: 'city bridge（城市桥梁）', label: '城市桥梁' },
  { value: 'rooftop terrace（屋顶天台）', label: '屋顶天台' },
  { value: 'industrial warehouse（工业风仓库）', label: '工业风仓库', tag: '光较杂' },
  { value: 'modern mall（现代商场）', label: '现代商场', tag: '室内' },
  { value: 'cafe corner（咖啡厅角落）', label: '咖啡厅角落', tag: '室内' },
  { value: 'office building lobby（写字楼大堂）', label: '写字楼大堂', tag: '室内' },
  { value: 'shopping center escalator（购物中心扶梯）', label: '购物中心扶梯', tag: '室内' },
  { value: 'flower shop entrance（花店门口）', label: '花店门口', tag: '室内' },
  { value: 'bookstore corner（书店角落）', label: '书店角落', tag: '室内' },
  { value: 'subway station（地铁站）', label: '地铁站', tag: '室内' },
  { value: 'photo studio（摄影棚）', label: '摄影棚', tag: '室内/棚拍' },
  { value: 'neon night scene（霓虹夜景）', label: '霓虹夜景', tag: '强冲突' },
];

const timeOfDayOptions: { value: string; label: string; tag?: string }[] = [
  { value: 'morning（早上）', label: '早上' },
  { value: 'noon（中午）', label: '中午' },
  { value: 'evening（傍晚）', label: '傍晚' },
  { value: 'night（晚上）', label: '晚上', tag: '叠夜景易假亮' },
];

const lightingOptions: { value: string; label: string; tag?: string }[] = [
  { value: '明亮柔和日光', label: '明亮柔和日光', tag: '户外推荐' },
  { value: '均匀日光', label: '均匀日光', tag: '户外阴天' },
  { value: '窗边自然光', label: '窗边自然光' },
  { value: '室内自然光', label: '室内自然光', tag: '室内' },
  { value: '通透日光', label: '通透日光' },
  { value: '黄昏柔光', label: '黄昏柔光' },
  { value: 'golden hour（黄金小时光）', label: '黄金小时光' },
  { value: '暖调柔光', label: '暖调柔光' },
  { value: '低角度柔和光', label: '低角度柔和光' },
  { value: '日落柔光', label: '日落柔光' },
  { value: '室内客厅自然光', label: '室内客厅自然光', tag: '室内' },
  { value: '室内卧室柔和光', label: '室内卧室柔和光', tag: '室内' },
  { value: '全局光', label: '全局光', tag: '易棚拍' },
  { value: '软光照明', label: '软光照明', tag: '易棚拍' },
  { value: '无硬阴影', label: '无硬阴影', tag: '易电商平光' },
  { value: '室内柔和顶灯', label: '室内柔和顶灯', tag: '易棚拍' },
  { value: '室内均匀光', label: '室内均匀光', tag: '易棚拍' },
  { value: '室内柔和照明', label: '室内柔和照明', tag: '易棚拍' },
  { value: '室内暖白光', label: '室内暖白光', tag: '易棚拍' },
];

const compositionOptions = [
  { value: 'half-body（半身）', label: '半身' },
  { value: 'full-body（全身）', label: '全身' },
];

const depthOfFieldOptions = [
  { value: 'slight', label: '轻微景深（自然虚化）' },
  { value: 'shallow', label: '浅景深（背景虚化）' },
  { value: 'deep', label: '深景深（背景清晰）' },
];

const aspectRatioOptions = [
  { value: '1:1', label: '1:1（方形）' },
  { value: '3:4', label: '3:4（竖向）' },
  { value: '4:3', label: '4:3（横向）' },
  { value: '9:16', label: '9:16（竖向）' },
  { value: '16:9', label: '16:9（横向）' },
];

const grainOptions = [
  { value: 'none', label: '无噪点' },
  { value: 'light', label: '轻微噪点' },
  { value: 'heavy', label: '浓厚噪点' },
];

const exposureModeOptions = [
  { value: 'natural', label: '自然（默认）' },
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

function withTag(label: string, tag?: string) {
  return tag ? `${label}〔${tag}〕` : label;
}

export function StepScene({ value, onChange }: StepSceneProps) {
  return (
    <>
      <div className="mb-6">
        <h3 className="text-[17px] font-bold text-[#2d2422] tracking-tight">场景配置</h3>
        <p className="hidden md:block text-[12px] text-[#9b8e82] mt-1 tracking-wide">
          选择场景模式，配置拍摄参数
        </p>
      </div>

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
                onMouseEnter={(e) => {
                  if (value.sceneSource !== 'preset') {
                    e.currentTarget.style.borderColor = 'rgba(125,155,118,0.2)';
                    e.currentTarget.style.color = '#5a7a53';
                  }
                }}
                onMouseLeave={(e) => {
                  if (value.sceneSource !== 'preset') {
                    e.currentTarget.style.borderColor = 'rgba(139,115,85,0.08)';
                    e.currentTarget.style.color = '#8b7355';
                  }
                }}
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
                onMouseEnter={(e) => {
                  if (value.sceneSource !== 'upload') {
                    e.currentTarget.style.borderColor = 'rgba(125,155,118,0.2)';
                    e.currentTarget.style.color = '#5a7a53';
                  }
                }}
                onMouseLeave={(e) => {
                  if (value.sceneSource !== 'upload') {
                    e.currentTarget.style.borderColor = 'rgba(139,115,85,0.08)';
                    e.currentTarget.style.color = '#8b7355';
                  }
                }}
              >
                <span className="inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> 参考场景</span>
              </button>
            </div>
          </div>

          {value.sceneSource === 'preset' && (
            <div className="flex flex-col gap-1.5 mb-4">
              <label htmlFor="scene-preset" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">预设场景</label>
              <select
                id="scene-preset"
                style={selectStyle}
                value={value.preset}
                onChange={(e) => {
                  const nextPreset = e.target.value;
                  const isStudioPreset = nextPreset === STUDIO_PRESET_VALUE;
                  const shouldSwitchLighting =
                    isStudioPreset &&
                    (!value.lighting || value.lighting === '明亮柔和日光' || value.lighting === '均匀日光' || value.lighting === 'golden hour（黄金小时光）');

                  onChange({
                    ...value,
                    preset: nextPreset,
                    lighting: shouldSwitchLighting ? STUDIO_LIGHTING_FALLBACK : value.lighting,
                  });
                }}
              >
                {presetOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{withTag(opt.label, opt.tag)}</option>
                ))}
              </select>
              <details className="rounded-xl border border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)] px-3 py-2.5 mt-1">
                <summary className="text-[11px] font-medium text-[#8b7355] cursor-pointer select-none">
                  哪些选项容易和「系统自动提示」打架？
                </summary>
                <div className="text-[11px] text-[#9b8e82] space-y-2 mt-2 leading-relaxed pl-0.5">
                  <p className="m-0">
                    系统在生图提示里默认强调：<strong className="text-[#7a6a5e] font-medium">户外混合自然光、反棚拍、反霓虹/HDR 假亮、反塑料皮</strong>。
                    下列自选若与场景语义叠在一起，模型容易左右互搏或出「假」。
                  </p>
                  <p className="m-0"><span className="text-[#c67b5c] font-medium">强冲突</span>：预设「霓虹夜景」——系统明确写了避免 neon rim / 过曝霓虹氛围，与场景名本身相反，除非你接受模型在中间妥协。</p>
                  <p className="m-0"><span className="text-[#b8956a] font-medium">室内</span>：商场、咖啡厅、大堂、扶梯、花店门口、书店、地铁站、摄影棚——主提示偏「户外街拍光」，室内人造光要靠场景词自洽；建议光照选「不指定」或在补充提示里写清窗光/顶光，或改用上传场景图。</p>
                  <p className="m-0"><span className="text-[#b8956a] font-medium">光杂</span>：工业仓库——高光比大，易偏戏剧或电商修图感，可配合「轻微噪点」或补充词压一下。</p>
                  <p className="m-0"><span className="text-[#b8956a] font-medium">时段·晚上</span>：若再叠夜景/霓虹类语义，和「自然日光主叙述」张力大；尽量用补充词或场景图定死光源。</p>
                  <p className="m-0"><span className="text-[#b8956a] font-medium">光照·易棚拍/电商</span>：全局光、软光照明、无硬阴影、各类室内顶灯/均匀光——与「非 fake studio、非大平光」冲突；街拍真实感优先请选「不指定」或户外日光类。</p>
                  <p className="m-0"><span className="text-[#7d9b76] font-medium">不指定时后端默认</span>：景深轻微虚化、画幅 3:4、无额外胶片颗粒（提示里仍可带轻微 sensor noise）。</p>
                </div>
              </details>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5 mb-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="time-of-day" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">时段</label>
              <select id="time-of-day" style={selectStyle} value={value.timeOfDay || ''} onChange={(e) => onChange({ ...value, timeOfDay: e.target.value })}>
                <option value="">不指定（仅用语景词，不写死时段）</option>
                {timeOfDayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{withTag(opt.label, opt.tag)}</option>
                ))}
              </select>
              <span className="text-[11px] text-[#c9bfb5] leading-relaxed">不写进场景串时，由预设名 + 系统自然光提示推断</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="lighting" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">光照</label>
              <select id="lighting" style={selectStyle} value={value.lighting || ''} onChange={(e) => onChange({ ...value, lighting: e.target.value })}>
                <option value="">不指定（推荐：由系统「自然街拍光」提示主导）</option>
                {lightingOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{withTag(opt.label, opt.tag)}</option>
                ))}
              </select>
              <span className="text-[11px] text-[#c9bfb5] leading-relaxed">
                {value.preset === STUDIO_PRESET_VALUE
                  ? '当前是「摄影棚」预设，建议使用棚拍光照（如软光照明/室内均匀光/室内柔和顶灯），以减少和自然街拍光提示冲突。'
                  : '留空时场景描述里不写光照词，生图提示词仍会强制户外混合自然光。若要手写，优先选户外日光类；「全局光」容易偏棚拍感。'}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="composition" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">构图</label>
              <select id="composition" style={selectStyle} value={value.composition || ''} onChange={(e) => onChange({ ...value, composition: e.target.value })}>
                <option value="">不指定（场景串不写构图，由画幅与内容推断）</option>
                {compositionOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="depth-of-field" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">景深</label>
              <select
                id="depth-of-field"
                style={selectStyle}
                value={value.depthOfField ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({
                    ...value,
                    depthOfField: v ? (v as 'slight' | 'shallow' | 'deep') : undefined,
                  });
                }}
              >
                <option value="">不指定（默认轻微景深·自然虚化）</option>
                {depthOfFieldOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="aspect-ratio" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">比例</label>
              <select
                id="aspect-ratio"
                style={selectStyle}
                value={value.aspectRatio ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({
                    ...value,
                    aspectRatio: v ? (v as '1:1' | '3:4' | '4:3' | '9:16' | '16:9') : undefined,
                  });
                }}
              >
                <option value="">不指定（默认 3:4 竖图）</option>
                {aspectRatioOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="grain" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">噪点</label>
              <select
                id="grain"
                style={selectStyle}
                value={value.grain ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({
                    ...value,
                    grain: v ? (v as 'none' | 'light' | 'heavy') : undefined,
                  });
                }}
              >
                <option value="">不指定（默认无额外颗粒，提示里仍可带轻微 sensor noise）</option>
                {grainOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
              <span className="text-[11px] text-[#c9bfb5] leading-relaxed">需要更「胶片/粗颗粒」时再选手动档</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="exposure-mode" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">曝光强度</label>
              <select
                id="exposure-mode"
                style={selectStyle}
                value={value.exposureMode ?? 'natural'}
                onChange={(e) => {
                  const v = e.target.value as 'natural' | 'bright' | 'dark';
                  onChange({
                    ...value,
                    exposureMode: v,
                  });
                }}
              >
                {exposureModeOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
              <span className="text-[11px] text-[#c9bfb5] leading-relaxed">默认自然；偏亮会提升画面亮度，偏暗会压高光避免过曝</span>
            </div>
          </div>
        </>
      )}

      {/* Prompt */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="scene-prompt" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">补充提示词</label>
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
          placeholder="例：阴天散射光、行人略远、手机抓拍略抖、橱窗弱反射（少写「大片/霓虹/强HDR」更易与系统一致）"
          rows={4}
        />
        <span className="text-[11px] text-[#c9bfb5] leading-relaxed">可选，添加更多细节描述以优化生成效果</span>
      </div>
    </>
  );
}
