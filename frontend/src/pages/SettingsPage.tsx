import { useState, useEffect } from "react";
import {
  TrashSimple,
  NotePencil,
  Plus,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { linksApi, serversApi, settingsApi } from "../api";
import type { NavLink, Server } from "../types";

export default function SettingsPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formLabels, setFormLabels] = useState("");
  const [editingServer, setEditingServer] = useState<Server | null>(null);

  // DeepSeek API key state
  const [dsKey, setDsKey] = useState("");
  const [dsKeySaved, setDsKeySaved] = useState(false);
  const [dsKeySaving, setDsKeySaving] = useState(false);
  const [dsKeyMasked, setDsKeyMasked] = useState(true);

  // OpenCode API config state
  const [ocUrl, setOcUrl] = useState("");
  const [ocUrlSaved, setOcUrlSaved] = useState(false);
  const [ocKey, setOcKey] = useState("");
  const [ocKeySaved, setOcKeySaved] = useState(false);
  const [ocKeyMasked, setOcKeyMasked] = useState(true);
  const [ocSaving, setOcSaving] = useState(false);

  // Link management state
  const [links, setLinks] = useState<NavLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkFormTitle, setLinkFormTitle] = useState("");
  const [linkFormUrl, setLinkFormUrl] = useState("");
  const [linkFormCategory, setLinkFormCategory] = useState("");
  const [linkSaved, setLinkSaved] = useState(false);
  const [editingLink, setEditingLink] = useState<NavLink | null>(null);

  useEffect(() => {
    loadServers();
    loadLinks();
    loadDsKey();
    loadOcConfig();
  }, []);

  // ── DeepSeek ────────────────────────────────────

  const loadDsKey = async () => {
    try {
      const { value } = await settingsApi.get("deepseek_api_key");
      setDsKey(value || "");
      setDsKeySaved(!!value);
    } catch { /* silent */ }
  };

  const handleSaveDsKey = async () => {
    setDsKeySaving(true);
    try {
      await settingsApi.set("deepseek_api_key", dsKey);
      setDsKeySaved(true);
      setDsKeyMasked(true);
    } catch {
      alert("保存失败");
    } finally {
      setDsKeySaving(false);
    }
  };

  // ── OpenCode ────────────────────────────────────

  const loadOcConfig = async () => {
    try {
      const [urlRes, keyRes] = await Promise.all([
        settingsApi.get("opencode_api_url"),
        settingsApi.get("opencode_api_key"),
      ]);
      setOcUrl(urlRes.value || "");
      setOcUrlSaved(!!urlRes.value);
      setOcKey(keyRes.value || "");
      setOcKeySaved(!!keyRes.value);
    } catch { /* silent */ }
  };

  const handleSaveOcConfig = async () => {
    setOcSaving(true);
    try {
      await Promise.all([
        settingsApi.set("opencode_api_url", ocUrl),
        settingsApi.set("opencode_api_key", ocKey),
      ]);
      setOcUrlSaved(true);
      setOcKeySaved(true);
      setOcKeyMasked(true);
    } catch {
      alert("保存失败");
    } finally {
      setOcSaving(false);
    }
  };

  const loadServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await serversApi.list();
      setServers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load servers");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formUrl.trim()) return;
    setSaving(true);
    try {
      const labels = formLabels.trim()
        ? formLabels.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      if (editingServer) {
        await serversApi.update(editingServer.id, {
          name: formName.trim(),
          metricsUrl: formUrl.trim(),
          labels,
        });
      } else {
        await serversApi.create({
          name: formName.trim(),
          metricsUrl: formUrl.trim(),
          labels,
        });
      }
      setShowForm(false);
      setEditingServer(null);
      setFormName("");
      setFormUrl("");
      setFormLabels("");
      await loadServers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存服务器失败");
    } finally {
      setSaving(false);
    }
  };

  const handleEditServer = (srv: Server) => {
    setEditingServer(srv);
    setFormName(srv.name);
    setFormUrl(srv.metricsUrl);
    setFormLabels((srv.labels || []).join(", "));
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this server?")) return;
    try {
      await serversApi.remove(id);
      await loadServers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete server");
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingServer(null);
    setFormName("");
    setFormUrl("");
    setFormLabels("");
  };

  // ── Links ────────────────────────────────────────

  const loadLinks = async () => {
    setLinksLoading(true);
    setLinksError(null);
    try {
      const data = await linksApi.list();
      setLinks(data);
    } catch (e) {
      setLinksError(e instanceof Error ? e.message : "Failed to load links");
    } finally {
      setLinksLoading(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkFormTitle.trim() || !linkFormUrl.trim()) return;
    setLinkSaving(true);
    try {
      if (editingLink) {
        await linksApi.update(editingLink.id, {
          title: linkFormTitle.trim(),
          url: linkFormUrl.trim(),
          category: linkFormCategory.trim() || undefined,
        });
      } else {
        await linksApi.create({
          title: linkFormTitle.trim(),
          url: linkFormUrl.trim(),
          category: linkFormCategory.trim() || undefined,
        });
      }
      setShowLinkForm(false);
      setEditingLink(null);
      setLinkFormTitle("");
      setLinkFormUrl("");
      setLinkFormCategory("");
      await loadLinks();
      setLinkSaved(true);
      setTimeout(() => setLinkSaved(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "添加链接失败");
    } finally {
      setLinkSaving(false);
    }
  };

  const handleEditLink = (link: NavLink) => {
    setEditingLink(link);
    setLinkFormTitle(link.title);
    setLinkFormUrl(link.url);
    setLinkFormCategory(link.category || "");
    setShowLinkForm(true);
  };

  const handleDeleteLink = async (id: number) => {
    if (!confirm("确定要删除这个链接吗？")) return;
    try {
      await linksApi.remove(id);
      await loadLinks();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete link");
    }
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-lg font-semibold text-zinc-100">Settings</h1>

      {/* ── Section 1: Data Sources ──────────────────── */}
      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Data Sources</h2>
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5 space-y-5">
          <DataSourceItem
            label="OpenCode 数据库路径"
            value="~/.local/share/opencode/opencode.db"
            connected
          />
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              DeepSeek API 密钥
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type={dsKeyMasked && dsKeySaved ? "password" : "text"}
                  value={dsKey}
                  onChange={(e) => { setDsKey(e.target.value); setDsKeySaved(false); }}
                  placeholder="输入 DeepSeek API 密钥"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 pr-9 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors font-mono"
                />
                {dsKeySaved && dsKey && (
                  <button
                    onClick={() => setDsKeyMasked(!dsKeyMasked)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    {dsKeyMasked ? "显示" : "隐藏"}
                  </button>
                )}
              </div>
              {dsKeySaved && (
                <span className="text-emerald-400 text-xs whitespace-nowrap">✓ 已保存</span>
              )}
              <button
                onClick={handleSaveDsKey}
                disabled={dsKeySaving || !dsKey.trim()}
                className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50"
              >
                {dsKeySaving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
          {/* OpenCode API */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              OpenCode API 地址
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={ocUrl}
                  onChange={(e) => { setOcUrl(e.target.value); setOcUrlSaved(false); }}
                  placeholder="https://example.com/api/opencode/usage"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors font-mono"
                />
              </div>
              {ocUrlSaved && ocUrl && (
                <span className="text-emerald-400 text-xs whitespace-nowrap">✓ 已保存</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              OpenCode API 密钥
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type={ocKeyMasked && ocKeySaved ? "password" : "text"}
                  value={ocKey}
                  onChange={(e) => { setOcKey(e.target.value); setOcKeySaved(false); }}
                  placeholder="输入 OpenCode API 密钥"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 pr-9 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors font-mono"
                />
                {ocKeySaved && ocKey && (
                  <button
                    onClick={() => setOcKeyMasked(!ocKeyMasked)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    {ocKeyMasked ? "显示" : "隐藏"}
                  </button>
                )}
              </div>
              {ocKeySaved && (
                <span className="text-emerald-400 text-xs whitespace-nowrap">✓ 已保存</span>
              )}
              <button
                onClick={handleSaveOcConfig}
                disabled={ocSaving}
                className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50"
              >
                {ocSaving ? "保存中..." : "保存"}
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              留空则使用本地 SQLite 数据。Agent 内置端点：<code className="text-zinc-500">http://&lt;agent-host&gt;:9100/api/opencode/sessions</code>
            </p>
          </div>
          <DataSourceItem
            label="PostgreSQL 连接"
            value="postgresql://zhangyuan@100.125.148.23:5432/tf_dashboard"
            connected
          />
        </div>
      </section>

      {/* ── Section 2: Servers Management ────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-300">Servers</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-md transition-colors"
          >
            <Plus size={14} weight="bold" />
            Add Server
          </button>
        </div>

        {/* Add Server Form */}
        {showForm && (
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5 mb-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="sv-01"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">
                  Metrics URL
                </label>
                <input
                  type="text"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="http://192.168.1.10:9100/metrics"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">
                  Labels
                </label>
                <input
                  type="text"
                  value={formLabels}
                  onChange={(e) => setFormLabels(e.target.value)}
                  placeholder="prod,web"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelForm}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formUrl.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "保存中..." : editingServer ? "更新" : "保存"}
              </button>
            </div>
          </div>
        )}

        {/* Server Table */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Loading...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-400">{error}</div>
          ) : servers.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              暂无服务器
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-xs font-medium text-zinc-500 py-3 px-4">
                    Name
                  </th>
                  <th className="text-left text-xs font-medium text-zinc-500 py-3 px-4">
                    Endpoint
                  </th>
                  <th className="text-left text-xs font-medium text-zinc-500 py-3 px-4">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 py-3 px-4 w-16">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {servers.map((server) => (
                  <tr
                    key={server.id}
                    className="bg-zinc-900/30 hover:bg-zinc-800/50 border-b border-zinc-800 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-zinc-300">
                      {server.name}
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-400 font-mono">
                      {server.metricsUrl}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                          server.isActive
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-zinc-500/10 text-zinc-500"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            server.isActive ? "bg-emerald-500" : "bg-zinc-500"
                          }`}
                        />
                        {server.isActive ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEditServer(server)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded"
                        title="编辑"
                      >
                        <NotePencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(server.id)}
                        className="p-1.5 text-red-500 hover:text-red-400 transition-colors rounded"
                        title="删除"
                      >
                        <TrashSimple size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Section 3: 网址导航 (Link Management) ──── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-zinc-300">网址导航</h2>
            {linkSaved && <span className="text-xs text-emerald-400">✓ 已保存</span>}
          </div>
          <button
            onClick={() => setShowLinkForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-md transition-colors"
          >
            <Plus size={14} weight="bold" />
            添加链接
          </button>
        </div>

        {/* Add Link Form */}
        {showLinkForm && (
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5 mb-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">
                  名称
                </label>
                <input
                  type="text"
                  value={linkFormTitle}
                  onChange={(e) => setLinkFormTitle(e.target.value)}
                  placeholder="DeepSeek"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">
                  网址
                </label>
                <input
                  type="text"
                  value={linkFormUrl}
                  onChange={(e) => setLinkFormUrl(e.target.value)}
                  placeholder="https://chat.deepseek.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">
                  分类
                </label>
                <input
                  type="text"
                  value={linkFormCategory}
                  onChange={(e) => setLinkFormCategory(e.target.value)}
                  placeholder="AI"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowLinkForm(false);
                  setEditingLink(null);
                  setLinkFormTitle("");
                  setLinkFormUrl("");
                  setLinkFormCategory("");
                }}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddLink}
                disabled={linkSaving || !linkFormTitle.trim() || !linkFormUrl.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {linkSaving ? "保存中..." : editingLink ? "更新" : "保存"}
              </button>
            </div>
          </div>
        )}

        {/* Link Table */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
          {linksLoading ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Loading...
            </div>
          ) : linksError ? (
            <div className="p-8 text-center text-sm text-red-400">{linksError}</div>
          ) : links.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              暂无链接
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-xs font-medium text-zinc-500 py-3 px-4">
                    名称
                  </th>
                  <th className="text-left text-xs font-medium text-zinc-500 py-3 px-4">
                    网址
                  </th>
                  <th className="text-left text-xs font-medium text-zinc-500 py-3 px-4">
                    分类
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 py-3 px-4 w-16">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr
                    key={link.id}
                    className="bg-zinc-900/30 hover:bg-zinc-800/50 border-b border-zinc-800 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-zinc-300">
                      {link.icon && (
                        <span className="mr-2">{link.icon}</span>
                      )}
                      {link.title}
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-400 font-mono">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-zinc-300 transition-colors"
                      >
                        {link.url}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-500">
                      {link.category && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800/50 text-zinc-400">
                          {link.category}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEditLink(link)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded"
                        title="编辑"
                      >
                        <NotePencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        className="p-1.5 text-red-500 hover:text-red-400 transition-colors rounded"
                        title="删除"
                      >
                        <TrashSimple size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Section 4: Polling Intervals ────────────── */}
      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-3">
          Polling Intervals
        </h2>
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
          <div className="grid grid-cols-3 gap-6">
            <PollingIntervalField label="OpenCode" value="60s" />
            <PollingIntervalField label="Server" value="30s" />
            <PollingIntervalField label="DeepSeek" value="300s" />
          </div>
        </div>
      </section>

      {/* ── Section 5: About ────────────────────────── */}
      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-3">About</h2>
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5 space-y-1">
          <p className="text-sm text-zinc-300 font-medium">
            tf-dashboard v0.1.0
          </p>
          <p className="text-xs text-zinc-500">
            技术栈 Bun + Hono + React + TypeScript + PostgreSQL
          </p>
          <p className="text-xs text-zinc-500">
            Data: OpenCode SQLite · DeepSeek API · HTTP /metrics
          </p>
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────

function DataSourceItem({
  label,
  value,
  connected,
}: {
  label: string;
  value: string;
  connected: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <code className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 font-mono truncate select-all">
          {value}
        </code>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
            connected
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {connected ? (
            <CheckCircle size={12} weight="fill" />
          ) : (
            <WarningCircle size={12} weight="fill" />
          )}
          {connected ? "已连接" : "未连接"}
        </span>
      </div>
    </div>
  );
}

function PollingIntervalField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5">{label}</label>
      <div className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-300 select-none cursor-default">
        {value}
      </div>
    </div>
  );
}
