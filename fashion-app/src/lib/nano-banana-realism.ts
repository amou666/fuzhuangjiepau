/**
 * nano-banana / nano-banana-2 等多走 Gemini 系生图路线，默认偏「干净、对比强、边缘利」。
 * 在最终 user 提示末尾追加一小段英文，压低塑料感与过度锐化倾向（不改变业务逻辑）。
 */
export function isNanoBananaFamilyModel(modelId: string): boolean {
  return /nano[-_]?banana/i.test(modelId.trim())
}

const NANO_BANANA_REALISM_APPEND = [
  'ENGINE NOTE (nano-banana family):',
  'Bias the output toward a single unedited camera frame — not a graded commercial still, not beauty-retouch software.',
  'Keep global contrast moderate; avoid HDR halos, neon edge glow, and micro-contrast halos on fabric weave.',
  'Skin: preserve fine pores and uneven tone in shadows; keep tiny facial asymmetry, subtle under-eye and smile-line texture, faint peach-fuzz; no porcelain blur or airbrush.',
  'Do not perform beauty retouch: no pore erasing, no skin whitening pass, no wrinkle suppression, no face-smoothing.',
  'Fabric: matte-to-satin response only; avoid synthetic wet shine or posterized folds.',
  'Do not exceed plausible optical sharpness for a 35–50mm street lens at f/2.8–f/5.6.',
].join(' ')

export function appendNanoBananaRealismHint(prompt: string, modelId: string): string {
  if (!isNanoBananaFamilyModel(modelId)) return prompt
  const base = prompt.trim()
  if (!base) return NANO_BANANA_REALISM_APPEND
  return `${base}\n\n${NANO_BANANA_REALISM_APPEND}`
}
