import { View, Text } from 'react-native'
import { Link } from 'expo-router'

export default function NotFoundScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
      <Text className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        页面不存在
      </Text>
      <Link href="/" className="text-blue-500 mt-4">
        返回首页
      </Link>
    </View>
  )
}
