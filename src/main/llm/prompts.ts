import type { ChatMessage } from './llm-client'
import type { Category, Tag, TaskWithRelations } from '../../shared/types'
import { formatLocalDate } from '../../shared/date-utils'

export function buildParseTaskPrompt(
  text: string,
  categories: Category[],
  tags: Tag[]
): ChatMessage[] {
  const today = formatLocalDate()
  const catList = categories.map((c) => `${c.id}: ${c.name}`).join(', ')
  const tagList = tags.map((t) => `${t.id}: ${t.name}`).join(', ')

  return [
    {
      role: 'system',
      content: `你是一个任务解析助手。用户会用自然语言描述一个待办事项，你需要将其解析为结构化 JSON。

今天日期：${today}

可用分类：[${catList}]
可用标签：[${tagList}]

输出 JSON 格式（严格遵守）：
{
  "title": "任务标题（简洁明确）",
  "description": "任务描述（补充细节，无则空字符串）",
  "priority": 0-4的整数（0=无, 1=低, 2=中, 3=高, 4=紧急），
  "categoryId": 分类ID或null（只能从可用分类中选择），
  "dueDate": "YYYY-MM-DD"或null（将相对日期如"明天""下周三"转为具体日期），
  "tagIds": [标签ID数组]（只能从可用标签中选择）
}

规则：
- "紧急"对应 priority 4，"高"/"重要"对应 3，"中"对应 2，"低"对应 1
- 相对日期基于今天 ${today} 计算
- categoryId 和 tagIds 只能使用提供的列表中的 ID
- 只输出 JSON，不要任何其他文字`
    },
    {
      role: 'user',
      content: text
    }
  ]
}

export function buildBatchParseTasksPrompt(
  text: string,
  categories: Category[],
  tags: Tag[]
): ChatMessage[] {
  const today = formatLocalDate()
  const catList = categories.map((c) => `${c.id}: ${c.name}`).join(', ')
  const tagList = tags.map((t) => `${t.id}: ${t.name}`).join(', ')

  return [
    {
      role: 'system',
      content: `你是一个任务解析助手。用户会用自然语言描述一批待办事项，你需要将其解析为多个结构化任务。

今天日期：${today}

可用分类：[${catList}]
可用标签：[${tagList}]

输出 JSON 格式（严格遵守）：
{
  "tasks": [
    {
      "title": "任务标题（简洁明确）",
      "description": "任务描述（补充细节，无则空字符串）",
      "priority": 0-4的整数（0=无, 1=低, 2=中, 3=高, 4=紧急），
      "categoryId": 分类ID或null（只能从可用分类中选择），
      "dueDate": "YYYY-MM-DD"或null（将相对日期如"明天""下周三"转为具体日期），
      "tagIds": [标签ID数组]（只能从可用标签中选择）
    }
  ]
}

规则：
- 从用户描述中提取出所有任务，每个任务一个条目
- 如果用户用换行、逗号、分号、数字编号等分隔了多个事项，拆分为多个任务
- **复合任务必须拆解**：如果一个事项包含多个可独立执行的子工作（如"技术方案设计、数据库设计、接口设计"），必须拆成多个独立任务，每个任务标题清晰可执行
- 如果只描述了一个简单任务，tasks 数组中只放一个
- "紧急"对应 priority 4，"高"/"重要"对应 3，"中"对应 2，"低"对应 1
- 相对日期基于今天 ${today} 计算
- 如果用户给了一个日期范围（如"2.16-2.20"或"本周"），将各任务的截止日期合理分布在这个范围内，不要全部设成同一天
- 每个任务的 dueDate 必须独立判断：用户明确指定了日期就用指定的，没指定的根据任务性质和紧急程度合理安排（紧急的靠前，普通的往后排）
- 如果用户完全没提到任何时间信息，则按任务顺序从今天起依次往后排（间隔1-3天）
- categoryId 和 tagIds 只能使用提供的列表中的 ID
- 只输出 JSON，不要任何其他文字`
    },
    {
      role: 'user',
      content: text
    }
  ]
}

export function buildDecomposeTaskPrompt(
  task: { title: string; description: string; categoryName?: string }
): ChatMessage[] {
  const context = task.categoryName ? `\n分类：${task.categoryName}` : ''

  return [
    {
      role: 'system',
      content: `你是一个任务拆解助手。将一个复杂任务拆分为 3-8 个可执行的子任务。

输出 JSON 格式（严格遵守）：
{
  "subtasks": [
    {
      "title": "子任务标题（简洁可执行）",
      "description": "子任务描述（简短说明）",
      "priority": 0-4的整数（0=无, 1=低, 2=中, 3=高, 4=紧急）
    }
  ]
}

规则：
- 每个子任务应该是具体可执行的步骤
- 子任务按逻辑顺序排列
- 优先级根据重要性和紧迫性分配
- 只输出 JSON，不要任何其他文字`
    },
    {
      role: 'user',
      content: `请拆解以下任务：\n标题：${task.title}\n描述：${task.description || '无'}${context}`
    }
  ]
}

export function buildGenerateReportPrompt(
  type: 'daily' | 'weekly',
  tasks: TaskWithRelations[],
  dateRange: { start: string; end: string }
): ChatMessage[] {
  const typeLabel = type === 'daily' ? '日报' : '周报'

  const taskSummary = tasks.map((t) => {
    const cat = t.category?.name || '未分类'
    const tagNames = t.tags.map((tag) => tag.name).join('、')
    const tags = tagNames ? ` [${tagNames}]` : ''
    return `- [${cat}] ${t.title}${tags}${t.completedAt ? ` (完成于 ${t.completedAt})` : ''}`
  }).join('\n')

  return [
    {
      role: 'system',
      content: `你是一个工作报告生成助手。根据已完成的任务列表生成${typeLabel}。

输出 JSON 格式（严格遵守）：
{
  "title": "${typeLabel}标题（包含日期）",
  "summary": "总体概述（1-2句话）",
  "sections": [
    {
      "category": "分类名称",
      "items": ["完成的事项描述"]
    }
  ],
  "highlights": ["今日/本周亮点（1-3条）"],
  "nextPlan": ["下一步计划（1-3条）"]
}

规则：
- sections 按分类汇总任务
- highlights 提炼关键成果
- nextPlan 基于已完成任务推测合理的后续工作
- 语言简洁专业
- 只输出 JSON，不要任何其他文字`
    },
    {
      role: 'user',
      content: `请生成${typeLabel}。\n日期范围：${dateRange.start} 至 ${dateRange.end}\n\n已完成任务（共${tasks.length}项）：\n${taskSummary || '（暂无已完成任务）'}`
    }
  ]
}

export function buildSuggestTagsPrompt(
  title: string,
  description: string | undefined,
  categories: Category[],
  tags: Tag[]
): ChatMessage[] {
  const catList = categories.map((c) => `${c.id}: ${c.name}`).join(', ')
  const tagList = tags.map((t) => `${t.id}: ${t.name}`).join(', ')

  return [
    {
      role: 'system',
      content: `你是一个任务分类助手。根据任务标题和描述，推荐最匹配的分类和标签。

可用分类：[${catList}]
可用标签：[${tagList}]

输出 JSON 格式（严格遵守）：
{
  "categoryId": 分类ID或null（从可用分类中选择最匹配的一个），
  "tagIds": [标签ID数组]（从可用标签中选择匹配的），
  "newTags": ["建议新建的标签名"]（如果现有标签不够用，最多建议2个）
}

规则：
- categoryId 只能从可用分类中选择
- tagIds 只能从可用标签中选择
- newTags 是现有标签无法覆盖时的补充建议
- 只输出 JSON，不要任何其他文字`
    },
    {
      role: 'user',
      content: `任务标题：${title}\n描述：${description || '无'}`
    }
  ]
}
