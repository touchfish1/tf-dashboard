import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../src/components/Card'
import { SectionHeader } from '../src/components/SectionHeader'
import { EmptyState } from '../src/components/EmptyState'
import { useRefresh } from '../src/hooks/useRefresh'
import { useAuditLogs } from '../src/hooks/useQueries'

const PAGE_SIZE = 50

const FILTERS = [
  { label: '全部', value: '' },
  { label: '服务器', value: 'server' },
  { label: '链接', value: 'link' },
  { label: '设置', value: 'settings' },
] as const

const DAY_OPTS = [
  { label: '7天', value: 7 },
  { label: '30天', value: 30 },
  { label: '90天', value: 90 },
] as const

const ACTION_LABELS: Record<string, string> = {
  'server.create': '创建服务器',
  'server.update': '更新服务器',
  'server.delete': '删除服务器',
  'link.create': '创建链接',
  'link.update': '更新链接',
  'link.delete': '删除链接',
  'settings.update': '更新设置',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'text-status-good',
  update: 'text-status-warn',
  delete: 'text-status-bad',
}

export default function AuditScreen() {
  const [typeFilter, setTypeFilter] = useState('')
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(0)
  const { refreshing, onRefresh } = useRefresh()
  const { data: logs, isLoading } = useAuditLogs(PAGE_SIZE, page * PAGE_SIZE, days, typeFilter)

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-paper-dark">
      <View className="flex-row items-center px-4 py-3 border-b border-line dark:border-line-dark">
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={22} color="#c23a2b" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-ink dark:text-ink-dark flex-1">操作审计</Text>
      </View>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c23a2b" />}
        className="flex-1 px-4"
        contentContainerClassName="py-4 gap-4"
      >
        <View className="px-1">
          <Text className="text-[26px] font-bold tracking-tight text-ink dark:text-ink-dark">审计</Text>
          <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">操作记录与变更历史</Text>
        </View>

        <View className="flex-row gap-2">
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => { setTypeFilter(f.value); setPage(0) }}
              activeOpacity={0.7}
              className={`px-3 py-1.5 rounded-full border ${typeFilter === f.value ? 'bg-accent border-accent' : 'bg-surface dark:bg-surface-dark border-line dark:border-line-dark'}`}
            >
              <Text className={`text-xs font-medium ${typeFilter === f.value ? 'text-white' : 'text-ink-muted dark:text-ink-muted-dark'}`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="flex-row gap-2">
          {DAY_OPTS.map((d) => (
            <TouchableOpacity
              key={d.value}
              onPress={() => { setDays(d.value); setPage(0) }}
              activeOpacity={0.7}
              className={`px-3 py-1.5 rounded-full border ${days === d.value ? 'bg-accent border-accent' : 'bg-surface dark:bg-surface-dark border-line dark:border-line-dark'}`}
            >
              <Text className={`text-xs font-medium ${days === d.value ? 'text-white' : 'text-ink-muted dark:text-ink-muted-dark'}`}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View className="gap-3">
            {[1, 2, 3].map((i) => (
              <View key={i} className="h-16 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-card animate-pulse" />
            ))}
          </View>
        ) : logs && logs.length > 0 ? (
          <Card className="gap-0 p-0 overflow-hidden">
            <View className="flex-row px-4 py-2.5 border-b border-line dark:border-line-dark bg-line/30 dark:bg-line-dark/30">
              <Text className="flex-[2] text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider">时间</Text>
              <Text className="flex-1 text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider">操作</Text>
              <Text className="flex-[2] text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider">资源</Text>
              <Text className="flex-1 text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-right">IP</Text>
            </View>
            {logs.map((log) => (
              <View key={log.id} className="flex-row px-4 py-3 border-b border-line dark:border-line-dark last:border-0 items-center">
                <Text className="flex-[2] text-[11px] font-mono text-ink-muted dark:text-ink-muted-dark">
                  {new Date(log.timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text className={`flex-1 text-[11px] font-medium ${ACTION_COLORS[log.action.split('.').pop() || ''] || 'text-ink dark:text-ink-dark'}`}>
                  {ACTION_LABELS[log.action] || log.action}
                </Text>
                <View className="flex-[2]">
                  <Text className="text-[11px] text-ink dark:text-ink-dark font-medium" numberOfLines={1}>{log.resource}</Text>
                  {log.detail && (
                    <Text className="text-[9px] text-ink-muted dark:text-ink-muted-dark mt-0.5" numberOfLines={1}>{log.detail}</Text>
                  )}
                </View>
                <Text className="flex-1 text-[10px] font-mono text-ink-muted dark:text-ink-muted-dark text-right">{log.ip}</Text>
              </View>
            ))}
          </Card>
        ) : (
          <Card><EmptyState icon="document-text-outline" title="暂无审计记录" /></Card>
        )}

        {logs && logs.length > 0 && (
          <View className="flex-row items-center justify-center gap-4 py-2">
            <TouchableOpacity
              onPress={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className={`px-4 py-2 rounded-full border ${page === 0 ? 'border-line opacity-40' : 'border-accent'}`}
            >
              <Text className={`text-xs font-medium ${page === 0 ? 'text-ink-muted' : 'text-accent'}`}>上一页</Text>
            </TouchableOpacity>
            <Text className="text-xs text-ink-muted dark:text-ink-muted-dark font-mono">第 {page + 1} 页</Text>
            <TouchableOpacity
              onPress={() => setPage(page + 1)}
              disabled={logs.length < PAGE_SIZE}
              className={`px-4 py-2 rounded-full border ${logs.length < PAGE_SIZE ? 'border-line opacity-40' : 'border-accent'}`}
            >
              <Text className={`text-xs font-medium ${logs.length < PAGE_SIZE ? 'text-ink-muted' : 'text-accent'}`}>下一页</Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  )
}
