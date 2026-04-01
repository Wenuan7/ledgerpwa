import type { Direction } from './types'
import { normalizeCategory } from './categories'

export type QuickParseResult = {
  direction: Direction
  amount: number
  category: string
  note?: string
}

const expenseCategoryRules: Array<{ category: string; keywords: string[] }> = [
  {
    category: '餐饮',
    keywords: [
      '吃',
      '饭',
      '火锅',
      '早餐',
      '午餐',
      '午饭',
      '晚饭',
      '夜宵',
      '外卖',
      '餐',
      '咖啡',
      '奶茶',
      '水果',
      '零食',
      '饮料',
      '酒',
      '菜',
      '食堂',
      '餐费',
      '餐饮',
      '就餐',
      '用餐',
      '餐补消费',
    ],
  },
  {
    category: '购物',
    keywords: [
      '买',
      '购物',
      '超市',
      '网购',
      '淘宝',
      '京东',
      '拼多多',
      '衣服',
      '日用品',
      '化妆品',
      '鞋',
      '包',
      '采购',
      '购置',
      '采买',
      '商品',
      '消费品',
    ],
  },
  {
    category: '交通',
    keywords: [
      '打车',
      '滴滴',
      '地铁',
      '公交',
      '巴士',
      '高铁',
      '火车',
      '飞机',
      '机票',
      '交通',
      '加油',
      '停车',
      '高速',
      '过路费',
      '共享单车',
      '骑车',
      '通勤',
      '差旅交通',
      '交通费',
      '出行',
    ],
  },
  {
    category: '娱乐',
    keywords: [
      '电影',
      '游戏',
      '娱乐',
      '会员',
      'ktv',
      'KTV',
      '演出',
      '演唱会',
      '直播',
      '充值',
      '订阅',
      '文娱',
      '休闲',
      '活动',
      '社交',
    ],
  },
  {
    category: '医疗',
    keywords: ['医疗', '看病', '医院', '门诊', '挂号', '买药', '药店', '检查', '体检', '牙科', '治疗', '诊疗'],
  },
  {
    category: '运动',
    keywords: [
      '运动',
      '健身',
      '跑步',
      '球馆',
      '游泳',
      '瑜伽',
      '羽毛球',
      '篮球',
      '器材',
      '私教',
      '训练',
      '课程',
      '卡丁车',
    ],
  },
  {
    category: '旅行',
    keywords: ['旅行', '旅游', '出差', '酒店', '民宿', '机票', '车票', '景区', '门票', '行李', '住宿', '差旅'],
  },
  {
    category: '工作',
    keywords: ['工作', '办公', '电脑', '打印', '文具', '工位', '会议', '业务', '客户', '材料', '办公费', '办公用品'],
  },
  {
    category: '其他',
    keywords: ['其他', '杂项', '杂费'],
  },
]

const incomeKeywords = [
  '收入',
  '工资',
  '退款',
  '返现',
  '奖金',
  '红包',
  '转账收入',
  '到账',
  '进账',
  '收款',
  '回款',
  '入账',
  '薪资',
  '薪水',
  '劳务费',
  '项目款',
]

/** 全角数字、常见分隔符规范化，便于匹配 */
function normalizeText(raw: string): string {
  let s = raw.trim()
  const fullToHalf: Record<string, string> = {
    '０': '0',
    '１': '1',
    '２': '2',
    '３': '3',
    '４': '4',
    '５': '5',
    '６': '6',
    '７': '7',
    '８': '8',
    '９': '9',
    '．': '.',
  }
  for (const [k, v] of Object.entries(fullToHalf)) {
    s = s.split(k).join(v)
  }
  s = s.replace(/,/g, '')
  return s
}

/**
 * 解析常见中文金额（万以内整数/小数），如：三百、三百五、三千五、十二块、一千二百
 */
function parseChineseAmountSegment(segment: string): number | null {
  const s = segment.replace(/\s/g, '')
  if (!s) return null

  const cn: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  }

  let section = 0
  let num = 0

  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    const d = cn[c]
    if (d !== undefined) {
      num = d
      continue
    }
    if (c === '十') {
      section += (num || 1) * 10
      num = 0
      continue
    }
    if (c === '百') {
      section += (num || 1) * 100
      num = 0
      continue
    }
    if (c === '千') {
      section += (num || 1) * 1000
      num = 0
      continue
    }
    if (c === '万') {
      section = ((section + num) || 1) * 10000
      num = 0
      continue
    }
  }

  const total = section + num
  if (total <= 0) return null
  return total
}

/** 从整句中提取中文金额（支持「三百块」或句中「晚饭火锅三百」） */
function extractChineseMoneyAmount(normalized: string): number | null {
  const withUnit = /([零一二三四五六七八九十百千万两]+)\s*(?:块|元|块钱)/g
  let best: number | null = null
  let m: RegExpExecArray | null
  while ((m = withUnit.exec(normalized)) !== null) {
    const n = parseChineseAmountSegment(m[1] ?? '')
    if (n !== null && n > 0) best = n
  }
  if (best !== null) return best

  const segments = normalized.match(/[零一二三四五六七八九十百千万两]+/g)
  if (!segments?.length) return null
  for (let i = segments.length - 1; i >= 0; i--) {
    const n = parseChineseAmountSegment(segments[i] ?? '')
    if (n !== null && n > 0) return n
  }
  return null
}

/** 取句中最后一个阿拉伯数字金额（兼容 12.5、1,234.56 已去逗号） */
function extractArabicAmount(normalized: string): number | null {
  const matches = [...normalized.matchAll(/(\d+(?:\.\d{1,2})?)\s*([kKwW万]?)?/g)]
  if (matches.length === 0) return null
  for (let i = matches.length - 1; i >= 0; i--) {
    const raw = Number(matches[i]![1])
    const unit = matches[i]![2] ?? ''
    if (!Number.isFinite(raw) || raw <= 0) continue
    let val = raw
    if (unit === 'k' || unit === 'K') val = raw * 1000
    if (unit === 'w' || unit === 'W' || unit === '万') val = raw * 10000
    if (Number.isFinite(val) && val > 0) return Number(val.toFixed(2))
  }
  return null
}

function extractAmount(text: string): number | null {
  const normalized = normalizeText(text)
  if (!normalized) return null

  const arabic = extractArabicAmount(normalized)
  const chinese = extractChineseMoneyAmount(normalized)
  const hasLatinDigit = /\d/.test(normalized)
  const hasChineseNumeral = /[零一二三四五六七八九十百千万两]/.test(normalized)

  if (arabic !== null && chinese !== null) {
    if (hasLatinDigit && !hasChineseNumeral) return arabic
    if (hasChineseNumeral && !hasLatinDigit) return chinese
    return arabic
  }
  return arabic ?? chinese
}

function inferDirection(text: string): Direction {
  const t = text.toLowerCase()
  return incomeKeywords.some((k) => t.includes(k.toLowerCase())) ? 'income' : 'expense'
}

function inferCategory(direction: Direction, text: string): string {
  if (direction === 'income') {
    if (text.includes('工资') || text.includes('奖金') || text.includes('薪资') || text.includes('薪水')) return '工资'
    return '其他'
  }
  const lower = text.toLowerCase()
  const matched = expenseCategoryRules.find((rule) => rule.keywords.some((kw) => lower.includes(kw.toLowerCase())))
  return matched ? matched.category : '餐饮'
}

export function parseQuickInput(raw: string): QuickParseResult | null {
  const text = raw.trim()
  if (!text) return null
  const amount = extractAmount(text)
  if (!amount) return null
  const direction = inferDirection(text)
  const category = normalizeCategory(direction, inferCategory(direction, text))
  return {
    direction,
    amount,
    category,
    note: text,
  }
}
