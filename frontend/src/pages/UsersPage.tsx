import { useState, useEffect } from "react";
import {
  TrashSimple,
  NotePencil,
  Plus,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";
import { trackAction } from "../lib/tracking";
import { usersApi } from "../api";
import { useAuth } from "../auth";
import type { User } from "../types";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useToast } from "@/components/Toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function UsersPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "viewer">("viewer");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // ── Dialog management ─────────────────────────────

  const openAddDialog = () => {
    setEditingUser(null);
    setFormEmail("");
    setFormPassword("");
    setFormDisplayName("");
    setFormRole("viewer");
    setDialogOpen(true);
  };

  const openEditDialog = (u: User) => {
    setEditingUser(u);
    setFormEmail(u.email);
    setFormPassword(""); // password field left empty — not required on edit
    setFormDisplayName(u.displayName);
    setFormRole(u.role);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingUser(null);
    setFormEmail("");
    setFormPassword("");
    setFormDisplayName("");
    setFormRole("viewer");
  };

  // ── Save (create / update) ────────────────────────

  const handleSave = async () => {
    const isEdit = !!editingUser;

    if (!formDisplayName.trim()) {
      toast("error", "请填写显示名称");
      return;
    }

    if (!isEdit && !formPassword.trim()) {
      toast("error", "请填写密码");
      return;
    }

    if (!isEdit && formPassword.length < 8) {
      toast("error", "密码至少 8 个字符");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await usersApi.update(editingUser!.id, {
          displayName: formDisplayName.trim(),
          role: formRole,
        });
        toast("success", "用户已更新");
      } else {
        await usersApi.create({
          email: formEmail.trim(),
          password: formPassword,
          displayName: formDisplayName.trim(),
          role: formRole,
        });
        toast("success", "用户已创建");
      }
      closeDialog();
      await loadUsers();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────

  const handleDelete = async (u: User) => {
    // Prevent deleting self
    if (currentUser?.id === u.id) {
      toast("error", "不能删除自己");
      return;
    }

    if (!confirm(`确定要删除用户「${u.displayName}」( ${u.email} ) 吗？`)) return;

    trackAction("用户管理", "删除用户", String(u.id));
    try {
      await usersApi.remove(u.id);
      await loadUsers();
      toast("success", "用户已删除");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  // ── Toggle active ─────────────────────────────────

  const handleToggleActive = async (u: User) => {
    // Prevent disabling self
    if (currentUser?.id === u.id) {
      toast("error", "不能禁用自己");
      return;
    }

    trackAction("用户管理", u.isActive ? "禁用用户" : "启用用户", String(u.id));
    try {
      await usersApi.update(u.id, { isActive: !u.isActive });
      await loadUsers();
      toast("success", u.isActive ? "用户已禁用" : "用户已启用");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  // ── Format helpers ────────────────────────────────

  function formatDate(d: string | null): string {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  }

  const ROLE_LABEL: Record<string, string> = {
    admin: "管理员",
    viewer: "查看者",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>用户管理</CardTitle>
          <Button variant="outline" size="sm" onClick={openAddDialog}>
            <Plus size={14} weight="bold" />
            添加用户
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-destructive">{error}</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              暂无用户
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>显示名称</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right w-20">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{u.displayName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          u.role === "admin"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-muted/10 text-muted-foreground border-border"
                        }
                      >
                        {ROLE_LABEL[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {u.isActive ? (
                          <CheckCircle size={14} className="text-emerald-400" weight="fill" />
                        ) : (
                          <XCircle size={14} className="text-muted-foreground" weight="fill" />
                        )}
                        <span className={u.isActive ? "text-emerald-400" : "text-muted-foreground"}>
                          {u.isActive ? "正常" : "已禁用"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(u.lastLogin)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(u)}
                          title="编辑"
                        >
                          <NotePencil size={16} />
                        </Button>
                        {currentUser?.id !== u.id && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleToggleActive(u)}
                            title={u.isActive ? "禁用" : "启用"}
                          >
                            {u.isActive ? (
                              <XCircle size={16} className="text-muted-foreground" />
                            ) : (
                              <CheckCircle size={16} className="text-emerald-400" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(u)}
                          title="删除"
                          className="text-destructive hover:text-destructive/80"
                        >
                          <TrashSimple size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog ─────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "编辑用户" : "添加用户"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>邮箱</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={!!editingUser}
              />
            </div>
            <div className="space-y-1.5">
              <Label>密码</Label>
              <Input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder={editingUser ? "留空则不修改" : "至少 8 个字符"}
              />
              {!editingUser && (
                <p className="text-xs text-muted-foreground">至少 8 个字符</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>显示名称</Label>
              <Input
                type="text"
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                placeholder="张三"
              />
            </div>
            <div className="space-y-1.5">
              <Label>角色</Label>
              <Select
                value={formRole}
                onValueChange={(v) => setFormRole(v as "admin" | "viewer")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="viewer">查看者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formDisplayName.trim() || (!editingUser && !formPassword.trim())}
            >
              {saving ? "保存中..." : editingUser ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
