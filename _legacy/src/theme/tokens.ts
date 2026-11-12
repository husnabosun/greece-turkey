/** Design tokens. Keep in sync with tailwind.config.js. */
export const colors = {
  bg: '#FAFAF8',
  card: '#FFFFFF',
  ink: '#151515',
  muted: '#6B6B6B',
  line: '#E6E6E2',
  soft: '#F1EFEA',
  risk: '#C9553A',
  riskSoft: '#FBE6DE',
  warn: '#C9A13B',
  warnSoft: '#F7EED6',
  warnText: '#A9831F',
  good: '#3F6B2F',
  goodSoft: '#E7F0E2',
  accent: '#2E6FB0',
  accentSoft: '#E8F0F8',
  /** Active tab circle + selected chips. Screens use dark green; CLAUDE.md says black. */
  primary: '#1F4A1F',
  dark: '#151515',
  lime: '#B9E09A',
  stage: '#DCE8F4',
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const radius = { card: 18, pill: 999 } as const;
/** Tab bar content height; the bottom safe area is added on top. */
export const TAB_BAR_HEIGHT = 64;
export const PHONE = { width: 390, height: 844, breakpoint: 500 } as const;
