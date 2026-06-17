import { View, Text } from 'react-native'
import { Link } from 'expo-router'

export default function NotFoundScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-surface dark:bg-surface-dark">
      <Text className="text-xl font-bold text-ink dark:text-ink-dark mb-2">
        页面不存在
      </Text>
      <Link href="/" className="text-accent mt-4">
        返回首页
      </Link>
    </View>
  )
}
