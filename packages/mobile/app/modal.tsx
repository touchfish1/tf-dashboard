import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ModalScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900 p-4">
      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
          操作
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-blue-500">关闭</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-gray-500 dark:text-gray-400">模态弹窗（待使用）</Text>
    </SafeAreaView>
  )
}
