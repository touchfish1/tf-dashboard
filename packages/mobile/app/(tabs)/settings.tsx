import { useState, useEffect } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../../src/components/Card'
import { SectionHeader } from '../../src/components/SectionHeader'
import { useRefresh } from '../../src/hooks/useRefresh'
import { useSettings } from '../../src/store/settings'
import { useAuth } from '../../src/store/auth'
import { trackAction } from '../../src/lib/tracking'

interface EditField {
  key: 'apiUrl' | 'apiKey' | 'deepseekKey'
  label: string
  placeholder: string
  secure: boolean
}

export default function SettingsScreen() {
  const { apiUrl, apiKey, deepseekKey, setApiUrl, setApiKey, setDeepseekKey } = useSettings()
  const { user, logout } = useAuth()
  const { refreshing, onRefresh } = useRefresh()
  const [editModal, setEditModal] = useState<EditField | null>(null)
  const [editValue, setEditValue] = useState('')

  // Notification channels state
  const [channelModalVisible, setChannelModalVisible] = useState(false)
  const [notificationChannels, setNotificationChannels] = useState<{ name: string; type: string; url: string }[]>([])
  const [channelName, setChannelName] = useState('')
  const [channelType, setChannelType] = useState<string>('slack')
  const [channelUrl, setChannelUrl] = useState('')

  // Report schedule state
  const [reportEnabled, setReportEnabled] = useState(false)
  const [reportDailyTime, setReportDailyTime] = useState('08:00')
  const [reportWeeklyTime, setReportWeeklyTime] = useState('09:00')

  // Load notification channels and report settings
  useEffect(() => {
    const base = apiUrl.replace(/\/$/, '')
    fetch(`${base}/api/settings/notification_channels`)
      .then((r) => r.json())
      .then((d) => {
        if (d.value) {
          try { setNotificationChannels(JSON.parse(d.value)) } catch {}
        }
      })
      .catch(() => {})
    fetch(`${base}/api/settings/report_schedule`)
      .then((r) => r.json())
      .then((d) => {
        if (d.value) {
          try {
            const s = JSON.parse(d.value)
            setReportEnabled(s.enabled ?? false)
            if (s.daily) setReportDailyTime(s.daily)
            if (s.weekly) setReportWeeklyTime(s.weekly)
          } catch {}
        }
      })
      .catch(() => {})
  }, [apiUrl])

  // Save notification channels
  const saveChannels = async () => {
    const base = apiUrl.replace(/\/$/, '')
    const newChannel = { name: channelName, type: channelType, url: channelUrl }
    const updated = [...notificationChannels, newChannel]
    await fetch(`${base}/api/settings/notification_channels`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(updated) }),
    })
    setNotificationChannels(updated)
    setChannelName('')
    setChannelType('slack')
    setChannelUrl('')
  }

  // Remove channel
  const removeChannel = async (index: number) => {
    const base = apiUrl.replace(/\/$/, '')
    const updated = notificationChannels.filter((_, i) => i !== index)
    await fetch(`${base}/api/settings/notification_channels`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(updated) }),
    })
    setNotificationChannels(updated)
  }

  // Save report schedule
  const handleSaveReport = async () => {
    const base = apiUrl.replace(/\/$/, '')
    const payload = {
      enabled: reportEnabled,
      daily: reportDailyTime,
      weekly: reportWeeklyTime,
    }
    await fetch(`${base}/api/settings/report_schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(payload) }),
    })
  }

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          trackAction('settings', 'logout')
          await logout()
          router.replace('/login')
        },
      },
    ])
  }

  const openEditor = (field: EditField) => {
    const current =
      field.key === 'apiUrl' ? apiUrl : field.key === 'apiKey' ? apiKey : deepseekKey
    setEditValue(current)
    setEditModal(field)
  }

  const saveEdit = async () => {
    if (!editModal) return
    const trimmed = editValue.trim()
    if (editModal.key === 'apiUrl') { await setApiUrl(trimmed || 'http://localhost:3000'); trackAction('settings', 'update_api_url') }
    else if (editModal.key === 'apiKey') { await setApiKey(trimmed); trackAction('settings', 'update_api_key') }
    else if (editModal.key === 'deepseekKey') { await setDeepseekKey(trimmed); trackAction('settings', 'update_deepseek_key') }
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

        {/* ─── Account / User Section ─────────────────────────── */}
        <Section title="账户">
          {user ? (
            <>
              <View className="px-4 py-4 flex-row items-center gap-3 border-b border-line dark:border-line-dark">
                <View className="w-10 h-10 rounded-full bg-accent items-center justify-center">
                  <Text className="text-white text-base font-bold">
                    {user.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-ink dark:text-ink-dark">{user.displayName}</Text>
                  <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">{user.email}</Text>
                </View>
                <View className="px-2.5 py-1 rounded-full bg-accent/10">
                  <Text className="text-xs font-medium text-accent">
                    {user.role === 'admin' ? '管理员' : '查看者'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleLogout}
                activeOpacity={0.7}
                className="flex-row items-center gap-3 px-4 py-3.5"
              >
                <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                <Text className="text-sm text-red-400 font-medium">退出登录</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/login')}
              activeOpacity={0.7}
              className="flex-row items-center gap-3 px-4 py-4"
            >
              <Ionicons name="log-in-outline" size={18} color="#10b981" />
              <Text className="text-sm text-accent font-medium flex-1">登录以访问完整功能</Text>
              <Ionicons name="chevron-forward" size={14} color="#a1a1aa" />
            </TouchableOpacity>
          )}
        </Section>

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

        <Section title="通知渠道">
          <SettingRow
            icon="notifications-outline"
            label="通知渠道"
            value={`${notificationChannels.length} 个已配置`}
            onPress={() => setChannelModalVisible(true)}
            last
          />
        </Section>

        <Section title="定期报告">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-line dark:border-line-dark">
            <Text className="text-sm text-ink dark:text-ink-dark">启用报告</Text>
            <TouchableOpacity onPress={() => setReportEnabled(!reportEnabled)}>
              <View className={`w-10 h-6 rounded-full ${reportEnabled ? 'bg-accent' : 'bg-zinc-300 dark:bg-zinc-700'} justify-center px-0.5`}>
                <View className={`w-5 h-5 rounded-full bg-white shadow-sm ${reportEnabled ? 'self-end' : 'self-start'}`} />
              </View>
            </TouchableOpacity>
          </View>
          {reportEnabled && (
            <>
              <View className="flex-row items-center px-4 py-3 border-b border-line dark:border-line-dark">
                <Text className="flex-1 text-sm text-ink dark:text-ink-dark">日报时间</Text>
                <TextInput value={reportDailyTime} onChangeText={setReportDailyTime} className="text-sm font-mono text-ink dark:text-ink-dark bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded" placeholder="08:00" />
              </View>
              <View className="flex-row items-center px-4 py-3 border-b border-line dark:border-line-dark">
                <Text className="flex-1 text-sm text-ink dark:text-ink-dark">周报时间</Text>
                <TextInput value={reportWeeklyTime} onChangeText={setReportWeeklyTime} className="text-sm font-mono text-ink dark:text-ink-dark bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded" placeholder="09:00" />
              </View>
              <TouchableOpacity onPress={handleSaveReport} className="px-4 py-3 items-center" activeOpacity={0.7}>
                <Text className="text-sm font-medium text-accent">保存报告设置</Text>
              </TouchableOpacity>
            </>
          )}
        </Section>

        <View className="h-8" />
      </ScrollView>

      {/* Channel Modal */}
      <Modal visible={channelModalVisible} transparent animationType="slide" onRequestClose={() => setChannelModalVisible(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white dark:bg-zinc-900 rounded-t-2xl max-h-[70%] p-5 gap-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-bold text-ink dark:text-ink-dark">通知渠道</Text>
              <TouchableOpacity onPress={() => setChannelModalVisible(false)}>
                <Ionicons name="close" size={20} color="#71717a" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1">
              {notificationChannels.length === 0 ? (
                <View className="py-6 items-center">
                  <Ionicons name="notifications-off-outline" size={24} color="#71717a" />
                  <Text className="text-sm text-ink-muted dark:text-ink-muted-dark mt-2">暂无通知渠道</Text>
                </View>
              ) : (
                notificationChannels.map((ch, i) => (
                  <View key={i} className="flex-row items-center gap-3 py-2.5 border-b border-line/50 dark:border-line-dark/50">
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-ink dark:text-ink-dark">{ch.name}</Text>
                      <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">{ch.type}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeChannel(i)}>
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Add channel form */}
            <View className="border-t border-line dark:border-line-dark pt-3 gap-2.5">
              <Text className="text-xs font-semibold text-ink dark:text-ink-dark">添加渠道</Text>
              <View className="flex-row gap-2">
                <View className="flex-1 gap-2">
                  <TextInput
                    value={channelName}
                    onChangeText={setChannelName}
                    className="bg-zinc-100 dark:bg-zinc-800 rounded-card-sm px-3 py-2 text-sm text-ink dark:text-ink-dark"
                    placeholder="名称"
                    placeholderTextColor="#71717a"
                  />
                  <TextInput
                    value={channelUrl}
                    onChangeText={setChannelUrl}
                    className="bg-zinc-100 dark:bg-zinc-800 rounded-card-sm px-3 py-2 text-sm text-ink dark:text-ink-dark"
                    placeholder="Webhook URL"
                    placeholderTextColor="#71717a"
                    autoCapitalize="none"
                  />
                  <View className="flex-row gap-1.5 flex-wrap">
                    {['slack', 'feishu', 'dingtalk', 'wecom', 'webhook_generic'].map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setChannelType(t)}
                        className={`px-2.5 py-1 rounded-full border ${channelType === t ? 'bg-accent border-accent' : 'bg-zinc-100 dark:bg-zinc-800 border-line dark:border-line-dark'}`}
                      >
                        <Text className={`text-[10px] ${channelType === t ? 'text-white' : 'text-ink-muted dark:text-ink-muted-dark'}`}>
                          {t === 'slack' ? 'Slack' : t === 'feishu' ? '飞书' : t === 'dingtalk' ? '钉钉' : t === 'wecom' ? '企微' : '通用'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={saveChannels}
                  disabled={!channelName || !channelUrl}
                  className="bg-accent rounded-card-sm px-4 justify-center"
                >
                  <Ionicons name="add" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
