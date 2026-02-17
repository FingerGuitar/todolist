import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useThemeStore, useSettingsStore } from '@/stores'
import { themeCategories } from '@/themes'
import type { LlmSettings } from '@shared/types'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function SettingRow({
  id,
  label,
  description,
  checked,
  onCheckedChange
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

const LLM_PRESETS: { label: string; baseUrl: string; provider: LlmSettings['provider']; model: string }[] = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', provider: 'openai-compatible', model: 'gpt-4o-mini' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', provider: 'openai-compatible', model: 'deepseek-chat' },
  { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', provider: 'openai-compatible', model: 'qwen-turbo' },
  { label: 'Ollama', baseUrl: 'http://localhost:11434/v1', provider: 'ollama', model: 'qwen2.5' }
]

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { currentTheme, customColor, setTheme, setCustomColor } = useThemeStore()
  const { settings, updateSettings } = useSettingsStore()
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateLlm = (partial: Partial<LlmSettings>) => {
    updateSettings({ llm: { ...settings.llm, ...partial } })
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.llmTest()
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: '测试请求失败' })
    } finally {
      setTesting(false)
    }
  }

  const handleThemeChange = async (themeName: string) => {
    await setTheme(themeName)
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, theme: themeName }
    }))
  }

  const handleCustomColorChange = async (hex: string) => {
    await setCustomColor(hex || null)
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, customColor: hex || undefined }
    }))
  }

  const handleClearCustomColor = async () => {
    await setCustomColor(null)
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, customColor: undefined }
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription className="sr-only">应用设置</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 通用 */}
          <div>
            <h3 className="text-sm font-medium mb-3">通用</h3>
            <div className="space-y-4">
              <SettingRow
                id="auto-launch"
                label="开机自启动"
                description="系统启动时自动打开应用"
                checked={settings.autoLaunch}
                onCheckedChange={(checked) => updateSettings({ autoLaunch: checked })}
              />
              <SettingRow
                id="close-to-tray"
                label="关闭时最小化到托盘"
                description="关闭窗口时隐藏到系统托盘而非退出应用"
                checked={settings.closeToTray}
                onCheckedChange={(checked) => updateSettings({ closeToTray: checked })}
              />
            </div>
          </div>

          <Separator />

          {/* 外观 */}
          <div>
            <h3 className="text-sm font-medium mb-3">外观</h3>
            <div className="space-y-3">
              {themeCategories.map((group) => (
                <div key={group.key}>
                  <span className="text-xs text-muted-foreground">{group.label}</span>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {group.themes.map((theme) => (
                      <button
                        key={theme.name}
                        type="button"
                        onClick={() => handleThemeChange(theme.name)}
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors cursor-pointer',
                          'hover:border-primary/50',
                          currentTheme === theme.name
                            ? 'border-primary bg-primary/5 font-medium'
                            : 'border-border'
                        )}
                      >
                        <span
                          className="h-3 w-3 rounded-full shrink-0 border border-border/50"
                          style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
                        />
                        <span className="truncate">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* 自定义主题色 */}
              <div className="pt-1">
                <span className="text-xs text-muted-foreground">自定义主题色</span>
                <div className="flex items-center gap-3 mt-1.5">
                  <label className="relative cursor-pointer">
                    <input
                      type="color"
                      value={customColor || '#6366f1'}
                      onChange={(e) => handleCustomColorChange(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <span
                      className="block h-8 w-8 rounded-md border border-border cursor-pointer"
                      style={{ backgroundColor: customColor || '#6366f1' }}
                    />
                  </label>
                  <span className="text-xs text-muted-foreground flex-1">
                    {customColor ? customColor.toUpperCase() : '未设置'}
                  </span>
                  {customColor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleClearCustomColor}
                    >
                      重置
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 每日标语 */}
          <div>
            <h3 className="text-sm font-medium mb-3">每日标语</h3>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">选择标题栏每日标语的风格</p>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {([
                  { value: 'funny', label: '幽默' },
                  { value: 'programmer', label: '程序员' },
                  { value: 'motivational', label: '励志' },
                  { value: 'sarcastic', label: '毒鸡汤' },
                  { value: 'literary', label: '文艺' },
                  { value: 'off', label: '关闭' }
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateSettings({ sloganStyle: opt.value })}
                    className={cn(
                      'rounded-md border px-3 py-2 text-xs transition-colors cursor-pointer',
                      'hover:border-primary/50',
                      settings.sloganStyle === opt.value
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'border-border'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* 任务 */}
          <div>
            <h3 className="text-sm font-medium mb-3">任务</h3>
            <div className="space-y-4">
              <SettingRow
                id="show-duration"
                label="显示任务用时"
                description="任务进入进行中状态时记录开始时间，完成时显示总用时"
                checked={settings.showTaskDuration}
                onCheckedChange={(checked) => updateSettings({ showTaskDuration: checked })}
              />
              <SettingRow
                id="confirm-delete"
                label="删除任务前确认"
                description="删除任务时弹出确认对话框，防止误删"
                checked={settings.confirmBeforeDelete}
                onCheckedChange={(checked) => updateSettings({ confirmBeforeDelete: checked })}
              />
              <SettingRow
                id="auto-postpone"
                label="自动延期逾期任务"
                description="逾期未完成的任务自动将截止日期更新为今天"
                checked={settings.autoPostponeOverdue}
                onCheckedChange={(checked) => updateSettings({ autoPostponeOverdue: checked })}
              />
            </div>
          </div>

          <Separator />

          {/* AI 智能助手 */}
          <div>
            <h3 className="text-sm font-medium mb-3">AI 智能助手</h3>
            <div className="space-y-4">
              <SettingRow
                id="llm-enabled"
                label="启用 AI 功能"
                description="接入大语言模型，支持智能创建、任务拆解、报告生成等"
                checked={settings.llm.enabled}
                onCheckedChange={(checked) => updateLlm({ enabled: checked })}
              />

              {settings.llm.enabled && (
                <div className="space-y-3 pl-1">
                  {/* 服务商预设 */}
                  <div>
                    <span className="text-xs text-muted-foreground">服务商预设</span>
                    <div className="grid grid-cols-4 gap-2 mt-1.5">
                      {LLM_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            updateLlm({
                              baseUrl: preset.baseUrl,
                              provider: preset.provider,
                              model: preset.model
                            })
                          }
                          className={cn(
                            'rounded-md border px-2 py-1.5 text-xs transition-colors cursor-pointer',
                            'hover:border-primary/50',
                            settings.llm.baseUrl === preset.baseUrl
                              ? 'border-primary bg-primary/5 font-medium'
                              : 'border-border'
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* API 地址 */}
                  <div className="grid gap-1.5">
                    <Label htmlFor="llm-base-url" className="text-xs">API 地址</Label>
                    <Input
                      id="llm-base-url"
                      placeholder="https://api.openai.com/v1"
                      value={settings.llm.baseUrl}
                      onChange={(e) => updateLlm({ baseUrl: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* API 密钥 */}
                  {settings.llm.provider !== 'ollama' && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="llm-api-key" className="text-xs">API 密钥</Label>
                      <Input
                        id="llm-api-key"
                        type="password"
                        placeholder="sk-..."
                        value={settings.llm.apiKey}
                        onChange={(e) => updateLlm({ apiKey: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}

                  {/* 模型名称 */}
                  <div className="grid gap-1.5">
                    <Label htmlFor="llm-model" className="text-xs">模型名称</Label>
                    <Input
                      id="llm-model"
                      placeholder="gpt-4o-mini"
                      value={settings.llm.model}
                      onChange={(e) => updateLlm({ model: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* 测试连接 */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleTestConnection}
                      disabled={testing}
                    >
                      {testing ? '测试中...' : '测试连接'}
                    </Button>
                    {testResult && (
                      <span
                        className={cn(
                          'text-xs',
                          testResult.success ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {testResult.message}
                      </span>
                    )}
                  </div>

                  {/* 高级设置 */}
                  <div>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      {showAdvanced ? '收起' : '展开'}高级设置
                    </button>
                    {showAdvanced && (
                      <div className="space-y-3 mt-2">
                        <div className="grid gap-1.5">
                          <Label htmlFor="llm-temperature" className="text-xs">
                            温度（{settings.llm.temperature}）
                          </Label>
                          <input
                            id="llm-temperature"
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={settings.llm.temperature}
                            onChange={(e) => updateLlm({ temperature: parseFloat(e.target.value) })}
                            className="w-full h-1.5 accent-primary"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="llm-max-tokens" className="text-xs">最大 Token</Label>
                          <Input
                            id="llm-max-tokens"
                            type="number"
                            value={settings.llm.maxTokens}
                            onChange={(e) => updateLlm({ maxTokens: parseInt(e.target.value) || 2048 })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="llm-timeout" className="text-xs">超时时间（秒）</Label>
                          <Input
                            id="llm-timeout"
                            type="number"
                            value={Math.round(settings.llm.timeoutMs / 1000)}
                            onChange={(e) =>
                              updateLlm({ timeoutMs: (parseInt(e.target.value) || 30) * 1000 })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
