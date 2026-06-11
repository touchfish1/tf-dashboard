import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../../src/components/Card'
import { SectionHeader } from '../../src/components/SectionHeader'
import { EmptyState } from '../../src/components/EmptyState'
import { ServerBadge } from '../../src/components/ServerBadge'
import { useRefresh } from '../../src/hooks/useRefresh'
import { useServers } from '../../src/hooks/useQueries'

export default function ServersScreen() {
  const { refreshing, onRefresh } = useRefresh()
  const { data: servers, isLoading } = useServers()

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
        className="flex-1 px-4"
        contentContainerClassName="py-4 gap-5"
      >
        {/* ─── Header ─── */}
        <View className="flex-row items-center justify-between px-1">
          <View>
            <Text className="text-[26px] font-bold tracking-tight text-ink dark:text-ink-dark">服务器</Text>
            <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">多服务器指标监控</Text>
          </View>
          {servers && (
            <View className="flex-row items-center gap-2">
              <ServerBadge status="online" label={`${servers.filter((s) => s.isActive).length} 在线`} />
            </View>
          )}
        </View>

        {/* ─── List ─── */}
        {isLoading ? (
          <View className="gap-3">
            {[1, 2, 3].map((i) => (
              <View key={i} className="bg-white dark:bg-surface-dark border border-line dark:border-line-dark rounded-card h-24 animate-pulse" />
            ))}
          </View>
        ) : servers && servers.length > 0 ? (
          <View className="gap-3 pb-8">
            {servers.map((server) => (
              <TouchableOpacity key={server.id} activeOpacity={0.7} onPress={() => router.push(`/servers/${server.id}`)}>
                <Card className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5">
                      <View className={`w-2.5 h-2.5 rounded-full ${server.isActive ? 'bg-status-good' : 'bg-status-bad'}`} />
                      <Text className="text-base font-semibold text-ink dark:text-ink-dark">{server.name}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#a1a1aa" />
                  </View>
                  <Text className="text-[11px] text-ink-muted dark:text-ink-muted-dark font-mono" numberOfLines={1}>
                    {server.metricsUrl}
                  </Text>

                  {/* Preview metrics */}
                  <View className="flex-row gap-4 pt-1">
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="pulse-outline" size={12} color="#a1a1aa" />
                      <Text className="text-[10px] font-mono text-ink-muted dark:text-ink-muted-dark">CPU —</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="server-outline" size={12} color="#a1a1aa" />
                      <Text className="text-[10px] font-mono text-ink-muted dark:text-ink-muted-dark">MEM —</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="time-outline" size={12} color="#a1a1aa" />
                      <Text className="text-[10px] font-mono text-ink-muted dark:text-ink-muted-dark">Uptime —</Text>
                    </View>
                  </View>

                  {server.labels && server.labels.length > 0 && (
                    <View className="flex-row flex-wrap gap-1.5">
                      {server.labels.map((label, i) => (
                        <View key={i} className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <Text className="text-[9px] font-medium text-ink-muted dark:text-ink-muted-dark">{label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState icon="server-outline" title="尚未添加服务器" message="在 Agent 所在服务器部署采集端点，然后在设置中添加" />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
