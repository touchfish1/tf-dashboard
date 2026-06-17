import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../src/components/Card'
import { EmptyState } from '../src/components/EmptyState'
import { useRefresh } from '../src/hooks/useRefresh'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../src/hooks/useQueries'
import { useAuth } from '../src/store/auth'

export default function UsersScreen() {
  const { refreshing, onRefresh } = useRefresh()
  const { data: users, isLoading } = useUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const currentUser = useAuth((s) => s.user)

  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer')
  const [error, setError] = useState('')

  const openAdd = () => {
    setEditingId(null)
    setEmail('')
    setPassword('')
    setDisplayName('')
    setRole('viewer')
    setError('')
    setModalVisible(true)
  }

  const openEdit = (u: { id: number; email: string; displayName: string; role: 'admin' | 'viewer' }) => {
    setEditingId(u.id)
    setEmail(u.email)
    setPassword('')
    setDisplayName(u.displayName)
    setRole(u.role)
    setError('')
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!displayName.trim()) { setError('请输入显示名称'); return }
    if (!editingId && !password) { setError('请输入密码'); return }
    if (!editingId && password.length < 8) { setError('密码至少 8 个字符'); return }
    setError('')
    try {
      if (editingId) {
        await updateUser.mutateAsync({ id: editingId, body: { displayName, role } })
      } else {
        await createUser.mutateAsync({ email, password, displayName, role })
      }
      setModalVisible(false)
    } catch (err: any) {
      setError(err.message || '操作失败')
    }
  }

  const handleToggleActive = (u: { id: number; isActive: boolean; email: string }) => {
    if (u.id === currentUser?.id) return
    updateUser.mutate({ id: u.id, body: { isActive: !u.isActive } })
  }

  const handleDelete = (u: { id: number; displayName: string }) => {
    if (u.id === currentUser?.id) { Alert.alert('提示', '不能删除自己'); return }
    Alert.alert('删除用户', `确定要删除「${u.displayName}」吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteUser.mutate(u.id) },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-paper-dark">
      <View className="flex-row items-center px-4 py-3 border-b border-line dark:border-line-dark">
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={22} color="#c23a2b" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-ink dark:text-ink-dark flex-1">用户管理</Text>
        <TouchableOpacity onPress={openAdd} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={22} color="#c23a2b" />
        </TouchableOpacity>
      </View>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c23a2b" />}
        className="flex-1 px-4"
        contentContainerClassName="py-4 gap-4"
      >
        <View className="px-1">
          <Text className="text-[26px] font-bold tracking-tight text-ink dark:text-ink-dark">用户管理</Text>
          <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">管理员与查看者</Text>
        </View>

        {isLoading ? (
          <View className="gap-3">
            {[1, 2, 3].map((i) => (
              <View key={i} className="h-16 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-card animate-pulse" />
            ))}
          </View>
        ) : users && users.length > 0 ? (
          <Card className="gap-0 p-0 overflow-hidden">
            <View className="flex-row px-4 py-2.5 border-b border-line dark:border-line-dark bg-line/30 dark:bg-line-dark/30">
              <Text className="flex-[2] text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider">用户</Text>
              <Text className="flex-1 text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-center">角色</Text>
              <Text className="flex-1 text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-center">状态</Text>
              <Text className="w-16 text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-right">操作</Text>
            </View>
            {users.map((u) => (
              <View key={u.id} className="flex-row px-4 py-3 border-b border-line dark:border-line-dark last:border-0 items-center">
                <View className="flex-[2]">
                  <Text className="text-xs font-medium text-ink dark:text-ink-dark">{u.displayName}</Text>
                  <Text className="text-[10px] font-mono text-ink-muted dark:text-ink-muted-dark">{u.email}</Text>
                </View>
                <View className="flex-1 items-center">
                  <View className={`px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-[#c23a2b]/10' : 'bg-line dark:bg-line-dark'}`}>
                    <Text className={`text-[9px] font-medium ${u.role === 'admin' ? 'text-accent' : 'text-ink-muted dark:text-ink-muted-dark'}`}>
                      {u.role === 'admin' ? '管理员' : '查看者'}
                    </Text>
                  </View>
                </View>
                <View className="flex-1 items-center">
                  <View className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-status-good' : 'bg-status-bad'}`} />
                </View>
                <View className="w-16 flex-row items-center justify-end gap-2">
                  <TouchableOpacity onPress={() => handleToggleActive(u)} disabled={u.id === currentUser?.id}>
                    <Ionicons
                      name={u.isActive ? 'toggle-outline' : 'toggle-outline'}
                      size={18}
                      color={u.isActive ? '#c23a2b' : '#7d7468'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(u)}>
                    <Ionicons name="create-outline" size={16} color="#7d7468" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(u)}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Card><EmptyState icon="people-outline" title="暂无用户" message="添加用户以分配管理权限" /></Card>
        )}

        <View className="h-8" />
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-surface dark:bg-surface-dark rounded-t-2xl p-5 gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-ink dark:text-ink-dark">
                {editingId ? '编辑用户' : '添加用户'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color="#7d7468" />
              </TouchableOpacity>
            </View>

            {!editingId && (
              <View className="gap-1.5">
                <Text className="text-xs font-medium text-ink-muted dark:text-ink-muted-dark ml-1">邮箱</Text>
                <TextInput
                  className="bg-line dark:bg-line-dark rounded-card-sm px-3 py-2.5 text-sm text-ink dark:text-ink-dark"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="user@example.com"
                  placeholderTextColor="#7d7468"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            )}

            <View className="gap-1.5">
              <Text className="text-xs font-medium text-ink-muted dark:text-ink-muted-dark ml-1">
                {editingId ? '密码（留空不修改）' : '密码'}
              </Text>
              <TextInput
                className="bg-line dark:bg-line-dark rounded-card-sm px-3 py-2.5 text-sm text-ink dark:text-ink-dark"
                value={password}
                onChangeText={setPassword}
                placeholder={editingId ? '留空则不修改' : '至少 8 个字符'}
                placeholderTextColor="#7d7468"
                secureTextEntry
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-medium text-ink-muted dark:text-ink-muted-dark ml-1">显示名称</Text>
              <TextInput
                className="bg-line dark:bg-line-dark rounded-card-sm px-3 py-2.5 text-sm text-ink dark:text-ink-dark"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="输入名称"
                placeholderTextColor="#7d7468"
              />
            </View>

            <View className="flex-row gap-2">
              {(['admin', 'viewer'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  className={`flex-1 py-2.5 rounded-full border ${role === r ? 'bg-accent border-accent' : 'bg-line dark:bg-line-dark border-line dark:border-line-dark'}`}
                >
                  <Text className={`text-xs font-medium text-center ${role === r ? 'text-white' : 'text-ink-muted dark:text-ink-muted-dark'}`}>
                    {r === 'admin' ? '管理员' : '查看者'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {error && (
              <View className="flex-row items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <Ionicons name="alert-circle" size={14} color="#ef4444" />
                <Text className="text-xs text-red-400 flex-1">{error}</Text>
              </View>
            )}

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="flex-1 py-2.5 rounded-full bg-line dark:bg-line-dark"
              >
                <Text className="text-xs font-medium text-ink-muted dark:text-ink-muted-dark text-center">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                className="flex-1 py-2.5 rounded-full bg-accent"
              >
                <Text className="text-xs font-medium text-white text-center">
                  {editingId ? '更新' : '创建'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
