import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../../src/components/Card'
import { SectionHeader } from '../../src/components/SectionHeader'
import { useRefresh } from '../../src/hooks/useRefresh'
import { useSettings } from '../../src/store/settings'

interface EditField {
  key: 'apiUrl' | 'apiKey' | 'deepseekKey'
  label: string
  placeholder: string
  secure: boolean
}

export default function SettingsScreen() {
  const { apiUrl, apiKey, deepseekKey, setApiUrl, setApiKey, setDeepseekKey } = useSettings()
  const { refreshing, onRefresh } = useRefresh()
  const [editModal, setEditModal] = useState<EditField | null>(null)
  const [editValue, setEditValue] = useState('')

  const openEditor = (field: EditField) => {
    const current =
      field.key === 'apiUrl' ? apiUrl : field.key === 'apiKey' ? apiKey : deepseekKey
    setEditValue(current)
    setEditModal(field)
  }

  const saveEdit = async () => {
    if (!editModal) return
    const trimmed = editValue.trim()
    if (editModal.key === 'apiUrl') await setApiUrl(trimmed || 'http://localhost:3000')
    else if (editModal.key === 'apiKey') await setApiKey(trimmed)
    else if (editModal.key === 'deepseekKey') await setDeepseekKey(trimmed)
    setEditModal(null)
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
        className="flex-1 px-4"
        contentContainerClassName="py-4 gap-6"
      >
        <View className="px-1">
          <Text className="text-[26px] font-bold tracking-tight text-ink dark:text-ink-dark">设置</Text>
          <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">配置数据源和偏好</Text>
        </View>

        <Section title="连接配置">
          <SettingRow
            icon="server-outline"
            label="API 地址"
            value={apiUrl}
            onPress={() => openEditor({ key: 'apiUrl', label: '后端 API 地址', placeholder: 'http://localhost:3000', secure: false })}
          />
          <SettingRow
            icon="key-outline"
            label="API Key"
            value={apiKey ? '••••••••' : '未设置'}
            onPress={() => openEditor({ key: 'apiKey', label: 'API 认证密钥', placeholder: '输入 API Key', secure: true })}
          />
          <SettingRow
            icon="diamond-outline"
            label="DeepSeek Key"
            value={deepseekKey ? '••••••••' : '未设置'}
            onPress={() => openEditor({ key: 'deepseekKey', label: 'DeepSeek API Key', placeholder: 'sk-...', secure: true })}
            last
          />
        </Section>

        <Section title="关于">
          <SettingRow icon="information-circle-outline" label="版本" value="0.1.0" />
          <SettingRow icon="server-outline" label="后端状态" value={apiUrl} />
          <SettingRow icon="leaf-outline" label="技术栈" value="Expo SDK 56" last />
        </Section>

        <View className="h-8" />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={!!editModal} transparent animationType="fade" onRequestClose={() => setEditModal(null)}>
        <View className="flex-1 bg-black/40 justify-center px-6">
          <View className="bg-white dark:bg-zinc-900 rounded-card p-5 gap-4">
            <Text className="text-base font-semibold text-ink dark:text-ink-dark">
              {editModal?.label}
            </Text>
            <TextInput
              className="bg-zinc-100 dark:bg-zinc-800 rounded-card-sm px-4 py-3 text-sm text-ink dark:text-ink-dark"
              placeholder={editModal?.placeholder}
              placeholderTextColor="#71717a"
              value={editValue}
              onChangeText={setEditValue}
              secureTextEntry={editModal?.secure}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View className="flex-row gap-3 justify-end">
              <TouchableOpacity
                onPress={() => setEditModal(null)}
                className="px-5 py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800"
              >
                <Text className="text-sm text-ink-muted dark:text-ink-muted-dark font-medium">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEdit}
                className="px-5 py-2.5 rounded-full bg-accent"
              >
                <Text className="text-sm text-white font-medium">保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <SectionHeader title={title} />
      <Card className="gap-0 p-0 overflow-hidden">{children}</Card>
    </View>
  )
}

function SettingRow({
  icon, label, value, onPress, last,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  onPress?: () => void
  last?: boolean
}) {
  const content = (
    <View className={`flex-row items-center gap-3 px-4 py-3.5 ${!last ? 'border-b border-line dark:border-line-dark' : ''}`}>
      <Ionicons name={icon} size={18} color="#71717a" />
      <Text className="flex-1 text-sm text-ink dark:text-ink-dark">{label}</Text>
      <Text className="text-xs text-ink-muted dark:text-ink-muted-dark max-w-[140px]" numberOfLines={1}>{value}</Text>
      {onPress && <Ionicons name="chevron-forward" size={14} color="#a1a1aa" />}
    </View>
  )

  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>
  return content
}
