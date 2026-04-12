import { useState } from 'react';
import type { ModelConfig } from '@/lib/types';
import { categoryOptions, ageOptions, ethnicityOptions, genderOptions, skinOptions, bodyOptions, heightOptions, faceShapeOptions, hairStyleOptions, hairColorOptions, faceFeatureOptions, poseOptions, expressionOptions } from '@/lib/model-options';
import { ImageUploader } from '@/lib/components/common/ImageUploader';
import { FavoriteBar } from './FavoriteBar';
import { Upload, Settings2, ChevronDown } from 'lucide-react';

interface StepModelProps {
  value: ModelConfig;
  onChange: (next: ModelConfig) => void;
  sceneMode?: 'preset' | 'replace';
}

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasAdvancedValues = !!(value.height || value.faceShape || value.hairStyle || value.hairColor || value.faceFeature || value.pose || value.expression);

  return (
    <>
      <div className="mb-6">
        <h3 className="text-[17px] font-bold text-[#2d2422] tracking-tight">模特配置</h3>
        <p className="hidden md:block text-[12px] text-[#9b8e82] mt-1 tracking-wide">
          设置基础参数即可生成，展开高级选项可精细调整
        </p>
      </div>

      <FavoriteBar
        type="model"
        currentData={value as unknown as Record<string, unknown>}
        onLoad={(data) => onChange(data as unknown as ModelConfig)}
        previewUrl={value.mode === 'upload' ? value.imageUrl : undefined}
      />

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

      {/* Basic Params */}
      <div className="mb-2">
        <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase mb-3">基础参数</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-category" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">类别</label>
          <select id="model-category" style={selectStyle} value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value })}>
            {categoryOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-gender" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">性别</label>
          <select id="model-gender" style={selectStyle} value={value.gender} onChange={(e) => onChange({ ...value, gender: e.target.value })}>
            {genderOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-ethnicity" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">人种</label>
          <select id="model-ethnicity" style={selectStyle} value={value.ethnicity} onChange={(e) => onChange({ ...value, ethnicity: e.target.value })}>
            {ethnicityOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-age" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">年龄</label>
          <select id="model-age" style={selectStyle} value={value.age} onChange={(e) => onChange({ ...value, age: e.target.value })}>
            {ageOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
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

      {/* Advanced Params */}
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5 mb-4 p-4 rounded-2xl border border-[rgba(139,115,85,0.06)] bg-[rgba(139,115,85,0.01)]">
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
            <label htmlFor="model-height" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">身高</label>
            <select id="model-height" style={selectStyle} value={value.height ?? ''} onChange={(e) => onChange({ ...value, height: e.target.value })}>
              {heightOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="model-face-shape" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">脸型</label>
            <select id="model-face-shape" style={selectStyle} value={value.faceShape ?? ''} onChange={(e) => onChange({ ...value, faceShape: e.target.value })}>
              {faceShapeOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="model-hair-style" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">发型</label>
            <select id="model-hair-style" style={selectStyle} value={value.hairStyle ?? ''} onChange={(e) => onChange({ ...value, hairStyle: e.target.value })}>
              {hairStyleOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="model-hair-color" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">发色</label>
            <select id="model-hair-color" style={selectStyle} value={value.hairColor ?? ''} onChange={(e) => onChange({ ...value, hairColor: e.target.value })}>
              {hairColorOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="model-face-feature" className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">妆造 / 面部细节</label>
            <select id="model-face-feature" style={selectStyle} value={value.faceFeature} onChange={(e) => onChange({ ...value, faceFeature: e.target.value })}>
              {faceFeatureOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>))}
            </select>
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
      )}
    </>
  );
}
