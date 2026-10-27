/** Keep in sync with src/theme/tokens.ts */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#FAFAF8',
        card: '#FFFFFF',
        ink: '#151515',
        muted: '#6B6B6B',
        line: '#E6E6E2',
        soft: '#F1EFEA',
        risk: { DEFAULT: '#C9553A', soft: '#FBE6DE' },
        warn: { DEFAULT: '#C9A13B', soft: '#F7EED6', text: '#A9831F' },
        good: { DEFAULT: '#3F6B2F', soft: '#E7F0E2' },
        accent: { DEFAULT: '#2E6FB0', soft: '#E8F0F8' },
        primary: '#1F4A1F',
        lime: '#B9E09A',
        stage: '#DCE8F4',
      },
      // Type scale. Names are prefixed to avoid clashing with colour classes like text-card.
      fontSize: {
        'ap-title': ['24px', '28px'],
        'ap-card': ['16px', '20px'],
        'ap-body': ['13px', '18px'],
        'ap-small': ['11px', '14px'],
        'ap-pill': ['12px', '16px'],
        'ap-btn': ['14px', '18px'],
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        i4: ['Inter_400Regular'],
        i5: ['Inter_500Medium'],
        i6: ['Inter_600SemiBold'],
        i7: ['Inter_700Bold'],
        i8: ['Inter_800ExtraBold'],
      },
    },
  },
};
