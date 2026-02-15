import { useMemo } from 'react'
import { Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useFilterStore, useCategoryStore, useTagStore, useSettingsStore } from '@/stores'
import type { ViewType } from '@/stores'
import type { AppSettings } from '@shared/types'

interface HeaderProps {
  onNewTask?: () => void
}

/** 视图类型到中文名称的映射 */
const VIEW_LABELS: Record<ViewType, string> = {
  inbox: '待办',
  today: '今天',
  upcoming: '即将到来',
  completed: '已完成',
  category: '分类',
  tag: '标签',
  all: '全部任务'
}

type SloganStyle = AppSettings['sloganStyle']

const SLOGANS: Record<Exclude<SloganStyle, 'off'>, string[]> = {
  programmer: [
    'Bug 不修，明天翻倍。',
    '代码能跑就行…吗？',
    '键盘敲得越响，效率越高（迷信）。',
    '咖啡续命，代码续梦。',
    '不是在写 Bug，就是在修 Bug 的路上。',
    '你和大佬的差距，只差一个回车。',
    '这个 Bug 不难，就是要花亿点时间。',
    'Deadline 是第一生产力。',
    '今天不加班的概率：正在计算中…',
    '理想：日清日结。现实：周五清周一的。',
    '搬砖使我快乐（大概）。',
    '摸鱼一时爽，加班火葬场。',
    '一杯茶，一支笔，一堆 TODO 等着你。',
    '别慌，DDL 还有……等等，今天？！',
    '先 commit，再 think。'
  ],
  motivational: [
    '先完成，再完美。',
    '完成比完美更重要。',
    '每完成一个任务，世界就美好一点。',
    '别想太多，先把第一个划掉。',
    '今天也是元气满满的一天！',
    '认真工作的样子，最帅。',
    '清空待办清单，就是今天的使命。',
    '今天也要做一个靠谱的人。',
    '千里之行，始于足下。',
    '你比你想象的更强大。',
    '自律即自由。',
    '坚持的人不一定成功，放弃的一定不会。',
    '把每一件小事做好，就是不简单。',
    '行动是治愈焦虑的良药。',
    '今天的努力，是明天的底气。'
  ],
  sarcastic: [
    '努力到感动自己（然后奖励自己摸鱼）。',
    '优秀的人都在努力，你还在看标语？',
    '拖延症晚期？不，你只是在蓄力。',
    '万事开头难，中间难，结尾也难。',
    '任务虐我千百遍，我待任务如初恋。',
    '今日事，今日毕。明日事…再说吧。',
    '条条大路通罗马，但你连门都没出。',
    '你的能力配不上你的野心——先做完这个任务吧。',
    '比你优秀的人还比你努力，你慌不慌？',
    '梦想还是要有的，万一实现了呢（大概率不会）。',
    '只要不看待办清单，就没有待办。',
    '世上无难事，只要肯放弃。',
    '听了很多道理，依然过不好这一天。',
    '你不是懒，你只是对无聊的事提不起兴趣。',
    '躺平虽好，可不要贪杯哦。'
  ],
  literary: [
    '日拱一卒，功不唐捐。',
    '不积跬步，无以至千里。',
    '静水流深，行稳致远。',
    '事了拂衣去，深藏功与名。',
    '莫听穿林打叶声，何妨吟啸且徐行。',
    '长风破浪会有时，直挂云帆济沧海。',
    '山高水远，道阻且长，行则将至。',
    '天行健，君子以自强不息。',
    '知行合一，方得始终。',
    '心之所向，素履以往。',
    '但行好事，莫问前程。',
    '纸上得来终觉浅，绝知此事要躬行。',
    '路漫漫其修远兮，吾将上下而求索。',
    '博观而约取，厚积而薄发。',
    '大道至简，知易行难。'
  ],
  funny: [
    '你的待办比你想象中少，快干！',
    '少刷手机，多划任务。',
    '今天的你，比昨天多划掉了一个任务！',
    '生活不止眼前的苟且，还有待办清单。',
    '据说把任务写下来，完成率提升 42%。',
    '你已经看了 3 秒标语了，该干活了。',
    '待办清单空了的那天，就是世界和平的那天。',
    '有任务就有希望，有希望就有压力。',
    '划掉一个任务的快感，仅次于拆快递。',
    '别看了别看了，任务不会自己完成的。',
    '打工人打工魂，打工都是人上人。',
    '今天不想努力了？那明天也不想哦。',
    '每天进步一点点，然后就到周末了。',
    '加油，打工人！此刻的你最美。',
    '干完这票就退休（每天都这么说）。'
  ]
}

function getDailySlogan(style: Exclude<SloganStyle, 'off'>): string {
  const list = SLOGANS[style]
  const now = new Date()
  const idx = (now.getFullYear() * 1000 + now.getMonth() * 32 + now.getDate()) % list.length
  return list[idx]
}

export function Header({ onNewTask }: HeaderProps) {
  const { currentView, selectedCategoryId, selectedTagId, searchQuery, setSearch } =
    useFilterStore()
  const { categories } = useCategoryStore()
  const { tags } = useTagStore()
  const sloganStyle = useSettingsStore((s) => s.settings.sloganStyle)

  const viewTitle = useMemo(() => {
    if (currentView === 'category' && selectedCategoryId !== null) {
      const cat = categories.find((c) => c.id === selectedCategoryId)
      return cat?.name ?? VIEW_LABELS.category
    }
    if (currentView === 'tag' && selectedTagId !== null) {
      const tag = tags.find((t) => t.id === selectedTagId)
      return tag?.name ?? VIEW_LABELS.tag
    }
    return VIEW_LABELS[currentView]
  }, [currentView, selectedCategoryId, selectedTagId, categories, tags])

  const slogan = useMemo(
    () => (sloganStyle !== 'off' ? getDailySlogan(sloganStyle) : null),
    [sloganStyle]
  )

  return (
    <header className="relative z-10 h-14 border-b border-border px-6 flex items-center bg-background shrink-0">
      {/* View title */}
      <h1 className="text-lg font-semibold whitespace-nowrap shrink-0">{viewTitle}</h1>

      {/* Daily slogan — centered */}
      {slogan && (
        <div className="flex-1 flex justify-center min-w-0 px-4">
          <span className="text-[11px] italic text-muted-foreground/50 truncate">
            —— {slogan} ——
          </span>
        </div>
      )}

      {/* Search + New task */}
      <div className={cn('flex items-center gap-3 shrink-0', !slogan && 'ml-auto')}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="搜索任务..."
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            className={cn('pl-9 h-9 w-56 text-sm')}
          />
        </div>
        <Button type="button" size="sm" className="cursor-pointer" onClick={() => onNewTask?.()}>
          <Plus className="h-4 w-4" />
          新建任务
        </Button>
      </div>
    </header>
  )
}
