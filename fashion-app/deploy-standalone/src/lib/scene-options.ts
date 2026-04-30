export interface SceneOption {
  value: string
  label: string
  category: 'outdoor' | 'indoor'
  conflict?: string
}

export const SCENE_OPTIONS: SceneOption[] = [
  { value: 'city street（城市街道）', label: '城市街道', category: 'outdoor' },
  { value: 'natural outdoor（自然外景）', label: '自然外景', category: 'outdoor' },
  { value: 'beach seaside（海滨沙滩）', label: '海滨沙滩', category: 'outdoor' },
  { value: 'urban park（城市公园）', label: '城市公园', category: 'outdoor' },
  { value: 'vintage street（复古街道）', label: '复古街道', category: 'outdoor' },
  { value: 'art district（艺术街区）', label: '艺术街区', category: 'outdoor' },
  { value: 'graffiti wall（涂鸦墙）', label: '涂鸦墙', category: 'outdoor' },
  { value: 'japanese alley（日式小巷）', label: '日式小巷', category: 'outdoor' },
  { value: 'european architecture（欧式建筑）', label: '欧式建筑', category: 'outdoor' },
  { value: 'city bridge（城市桥梁）', label: '城市桥梁', category: 'outdoor' },
  { value: 'rooftop terrace（屋顶天台）', label: '屋顶天台', category: 'outdoor' },
  { value: 'industrial warehouse（工业风仓库）', label: '工业风仓库', category: 'indoor' },
  { value: 'modern mall（现代商场）', label: '现代商场', category: 'indoor' },
  { value: 'cafe corner（咖啡厅角落）', label: '咖啡厅角落', category: 'indoor' },
  { value: 'office building lobby（写字楼大堂）', label: '写字楼大堂', category: 'indoor' },
  { value: 'shopping center escalator（购物中心扶梯）', label: '购物中心扶梯', category: 'indoor' },
  { value: 'flower shop entrance（花店门口）', label: '花店门口', category: 'indoor' },
  { value: 'bookstore corner（书店角落）', label: '书店角落', category: 'indoor' },
  { value: 'subway station（地铁站）', label: '地铁站', category: 'indoor' },
  { value: 'photo studio（摄影棚）', label: '摄影棚', category: 'indoor' },
  { value: 'neon night scene（霓虹夜景）', label: '霓虹夜景', category: 'outdoor', conflict: '霓虹夜景与系统的自然光风格有较大差异，效果可能偏艺术化' },
]
