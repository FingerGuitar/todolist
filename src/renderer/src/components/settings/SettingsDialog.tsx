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
import { useThemeStore, useSettingsStore } from '@/stores'
import { themeCategories } from '@/themes'

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

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { currentTheme, customColor, setTheme, setCustomColor } = useThemeStore()
  const { settings, updateSettings } = useSettingsStore()

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
        </div>
      </DialogContent>
    </Dialog>
  )
}
