import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Loader2, CalendarIcon, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import type { LlmGenerateReportResult } from '@shared/types'
import { formatLocalDate } from '@shared/date-utils'

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportDialog({ open, onOpenChange }: ReportDialogProps) {
  const [reportType, setReportType] = useState<'daily' | 'weekly'>('daily')
  const [date, setDate] = useState<Date>(new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<LlmGenerateReportResult['data'] | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) {
      setReport(null)
      setError('')
      setLoading(false)
      setCopied(false)
    }
  }, [open])

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const result = await window.api.llmGenerateReport({
        type: reportType,
        date: formatLocalDate(date)
      })
      if (result.success && result.data) {
        setReport(result.data)
      } else {
        setError(result.error || '生成失败')
      }
    } catch {
      setError('请求失败，请检查 AI 配置')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!report?.markdown) return
    await navigator.clipboard.writeText(report.markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>生成工作报告</DialogTitle>
          <DialogDescription className="sr-only">生成日报或周报</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 报告类型 + 日期 */}
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border">
              <button
                type="button"
                className={cn(
                  'px-3 py-1.5 text-xs transition-colors cursor-pointer',
                  reportType === 'daily'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
                onClick={() => setReportType('daily')}
              >
                日报
              </button>
              <button
                type="button"
                className={cn(
                  'px-3 py-1.5 text-xs transition-colors cursor-pointer',
                  reportType === 'weekly'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
                onClick={() => setReportType('weekly')}
              >
                周报
              </button>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <CalendarIcon className="h-3 w-3 mr-1.5" />
                  {format(date, 'yyyy年M月d日', { locale: zhCN })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  locale={zhCN}
                />
              </PopoverContent>
            </Popover>

            <Button
              size="sm"
              className="h-8"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {loading ? '生成中...' : '生成报告'}
            </Button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* 报告内容 */}
          {report && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{report.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <><Check className="h-3 w-3 mr-1" />已复制</>
                  ) : (
                    <><Copy className="h-3 w-3 mr-1" />复制 Markdown</>
                  )}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">{report.summary}</p>

              {report.sections.map((section, i) => (
                <div key={i}>
                  <h4 className="text-xs font-medium mb-1">{section.category}</h4>
                  <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                    {section.items.map((item, j) => (
                      <li key={j} className="list-disc">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}

              {report.highlights.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium mb-1">亮点</h4>
                  <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                    {report.highlights.map((h, i) => (
                      <li key={i} className="list-disc">{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {report.nextPlan.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium mb-1">下步计划</h4>
                  <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                    {report.nextPlan.map((p, i) => (
                      <li key={i} className="list-disc">{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
