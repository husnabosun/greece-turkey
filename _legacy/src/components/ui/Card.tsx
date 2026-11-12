import { View, type ViewProps } from 'react-native';

export function Card({ className = '', ...props }: ViewProps & { className?: string }) {
  return <View className={`rounded-[18px] border border-line bg-card ${className}`} {...props} />;
}
