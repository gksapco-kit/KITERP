/** Section edge divider shapes (Origins). */
export const SHAPE_OPTIONS = [
  { id: 'none', label: '⊘ None' },
  { id: 'wave', label: '〜 Wave' },
  { id: 'wave_soft', label: '〰 Soft Wave' },
  { id: 'curve', label: '⌣ Curve' },
  { id: 'curve_deep', label: '⌢ Deep Curve' },
  { id: 'slant', label: '/ Slant →' },
  { id: 'slant_r', label: '\\ Slant ←' },
  { id: 'arrow_down', label: '▼ Arrow' },
  { id: 'arrow_up', label: '▲ Arrow Up' },
  { id: 'zigzag', label: '⋀ Zigzag' },
  { id: 'triangle', label: '△ Triangle' },
  { id: 'tilt', label: '⬡ Tilt' },
] as const

export const SHADOW_PRESETS = [
  { label: 'None', value: 'none' },
  { label: 'Soft', value: '0 4px 24px 0 rgba(0,0,0,0.08)' },
  { label: 'Medium', value: '0 8px 40px 0 rgba(0,0,0,0.16)' },
  { label: 'Harsh', value: '4px 4px 0px 0px rgba(0,0,0,0.85)' },
  { label: 'Glow Vio', value: '0 0 40px 10px rgba(124,58,237,0.35)' },
  { label: 'Glow Blue', value: '0 0 40px 10px rgba(59,130,246,0.35)' },
  { label: 'Glow Pink', value: '0 0 40px 10px rgba(251,113,133,0.35)' },
  { label: 'Inner', value: 'inset 0 2px 16px 0 rgba(0,0,0,0.12)' },
] as const

export const BG_STYLE_OPTIONS = [
  { id: 'gradient', label: 'Gradient' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'image', label: 'Image' },
  { id: 'dark', label: 'Dark' },
  { id: 'split', label: 'Split' },
] as const

export const VISUAL_INSERT_TYPES = [
  { type: 'text', label: '📝 Text Box', desc: 'Editable text overlay' },
  { type: 'image', label: '🖼 Image', desc: 'Draggable image layer' },
  { type: 'button', label: '🔘 Button', desc: 'Clickable button element' },
  { type: 'box', label: '⬜ Box / Card', desc: 'Styled container shape' },
  { type: 'badge', label: '🏷 Badge', desc: 'Label or tag chip' },
  { type: 'icon', label: '◆ Icon', desc: 'Pick from a library of icons' },
  { type: 'video', label: '▶ Video', desc: 'Video media layer' },
  { type: 'link', label: '🔗 Link', desc: 'Button that opens a URL or internal page' },
  { type: 'db_link', label: '🔌 Connect to Data', desc: 'Link to a product, service, team member…' },
  { type: 'store', label: '🏬 Connect to Store', desc: 'Switch to a specific outlet / branch' },
] as const
