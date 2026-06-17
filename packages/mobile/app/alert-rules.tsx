import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../src/components/Card'
import { EmptyState } from '../src/components/EmptyState'
import { useRefresh } from '../src/hooks/useRefresh'
import { useAlertRules, useUpdateAlertRule, useDeleteAlertRule } from '../src/hooks/useQueries'

const SEVERITY_CONFIG = {
  info: { label: '信息', color: 'text-status-info', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  warning: { label: '警告', color: 'text-status-warn', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  critical: { label: '严重', color: 'text-status-bad', bg: 'bg-red-100 dark:bg-red-900/30' },
} as const

export default function AlertRulesScreen() {
  const { refreshing, onRefresh } = useRefresh()
  const { data: rules, isLoading } = useAlertRules()
  const updateRule = useUpdateAlertRule()
  const deleteRule = useDeleteAlertRule()

  const handleToggle = (rule: { id: number; enabled: boolean }) => {
    updateRule.mutate({ id: rule.id, body: { enabled: !rule.enabled } })
  }

  const handleDelete = (id: number, name: string) => {
    Alert.alert('删除规则', `确定要删除「${name}」吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteRule.mutate(id) },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-paper-dark">
      <View className="flex-row items-center px-4 py-3 border-b border-line dark:border-line-dark">
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={22} color="#c23a2b" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-ink dark:text-ink-dark flex-1">告警规则</Text>
      </View>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c23a2b" />}
        className="flex-1 px-4"
        contentContainerClassName="py-4 gap-4"
      >
        <View className="px-1">
          <Text className="text-[26px] font-bold tracking-tight text-ink dark:text-ink-dark">告警规则</Text>
          <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">触发条件与通知策略</Text>
        </View>

        {isLoading ? (
          <View className="gap-3">
            {[1, 2].map((i) => (
              <View key={i} className="h-32 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-card animate-pulse" />
            ))}
          </View>
        ) : rules && rules.length > 0 ? (
          <View className="gap-3 pb-8">
            {rules.map((rule) => {
              const sev = SEVERITY_CONFIG[rule.severity]
              return (
                <Card key={rule.id} className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1">
                      <Text className="text-sm font-semibold text-ink dark:text-ink-dark" numberOfLines={1}>{rule.name}</Text>
                      <View className={`px-2 py-0.5 rounded-full ${sev.bg}`}>
                        <Text className={`text-[9px] font-medium ${sev.color}`}>{sev.label}</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleToggle(rule)} activeOpacity={0.7}>
                      <View className={`w-9 h-5 rounded-full ${rule.enabled ? 'bg-accent' : 'bg-line dark:bg-line-dark'} justify-center px-0.5`}>
                        <View className={`w-4 h-4 rounded-full bg-white shadow-sm ${rule.enabled ? 'self-end' : 'self-start'}`} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  <Text className="text-[11px] text-ink-muted dark:text-ink-muted-dark leading-5">
                    {rule.matchMode === 'all' ? '所有条件满足' : '任一条件满足'}：
                    {rule.conditions.map((c, i) => (
                      <Text key={i}>
                        {i > 0 && (rule.matchMode === 'all' ? ' 且 ' : ' 或 ')}
                        <Text className="font-mono text-accent">{c.field}</Text>
                        {c.operator !== 'true' && (
                          <Text> {c.operator} {c.value}{c.unit || ''}</Text>
                        )}
                      </Text>
                    ))}
                  </Text>

                  <View className="flex-row items-center justify-between pt-1 border-t border-line/50 dark:border-line-dark/50">
                    <Text className="text-[10px] text-ink-muted dark:text-ink-muted-dark font-mono">
                      冷却 {rule.cooldownMinutes}分钟
                    </Text>
                    <View className="flex-row gap-3">
                      {rule.notificationChannels.length > 0 && (
                        <Text className="text-[10px] text-ink-muted dark:text-ink-muted-dark" numberOfLines={1}>
                          {rule.notificationChannels.join(', ')}
                        </Text>
                      )}
                      <TouchableOpacity onPress={() => handleDelete(rule.id, rule.name)}>
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              )
            })}
          </View>
        ) : (
          <Card><EmptyState icon="notifications-off-outline" title="暂无告警规则" message="在 Web 端添加告警规则以接收通知" /></Card>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
