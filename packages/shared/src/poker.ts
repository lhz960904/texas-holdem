import type { Rank } from './types'

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

export const HAND_RANK_NAMES: Record<string, string> = {
  'high-card': '高牌', 'one-pair': '一对', 'two-pair': '两对',
  'three-of-a-kind': '三条', 'straight': '顺子', 'flush': '同花',
  'full-house': '葫芦', 'four-of-a-kind': '四条',
  'straight-flush': '同花顺', 'royal-flush': '皇家同花顺',
}
