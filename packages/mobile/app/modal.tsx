import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ModalScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark p-4">
      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-lg font-bold text-ink dark:text-ink-dark">
          操作
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-accent">关闭</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-ink-muted dark:text-ink-muted-dark">模态弹窗（待使用）</Text>
    </SafeAreaView>
  )
}
