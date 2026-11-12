import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

const variants = {
  risk: ['bg-risk', 'text-white'],
  dark: ['bg-ink', 'text-white'],
  primary: ['bg-primary', 'text-white'],
  outline: ['bg-card border border-ink', 'text-ink'],
} as const;

interface Props {
  label: string;
  onPress?: () => void;
  variant?: keyof typeof variants;
  icon?: ReactNode;
  /** Less side padding, for buttons that share a row. */
  compact?: boolean;
  className?: string;
}

export function Button({ label, onPress, variant = 'dark', icon, compact = false, className = '' }: Props) {
  const [bg, fg] = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`h-11 flex-row items-center justify-center gap-1.5 rounded-full ${compact ? 'px-2' : 'px-5'} active:opacity-80 ${bg} ${className}`}
    >
      {icon}
      <Text className={`font-i7 text-ap-btn ${fg}`}>{label}</Text>
    </Pressable>
  );
}
