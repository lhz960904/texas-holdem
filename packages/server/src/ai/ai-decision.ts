import Anthropic from '@anthropic-ai/sdk'
import type { Card } from '@texas-holdem/shared'
import type { AIPersonality } from './personalities'
import { calculateEquity, calculatePotOdds, evaluateHand } from './hand-evaluator'

export interface GameContext {
  holeCards: [Card, Card]
  communityCards: Card[]
  pot: number
  currentBet: number
  myBet: number
  myChips: number
  minRaise: number // minimum raise INCREMENT from engine
  numOpponents: number
  phase: string
  position: string
  actionHistory: string[]
}

export interface AIAction {
  type: 'fold' | 'check' | 'call' | 'raise' | 'allIn'
  amount?: number // For raise: TOTAL bet amount (not increment)
}

let anthropic: Anthropic | null = null

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!anthropic) {
    anthropic = new Anthropic()
  }
  return anthropic
}

function formatCard(card: Card): string {
  const suitSymbol: Record<string, string> = {
    hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
  }
  return `${card.rank}${suitSymbol[card.suit]}`
}

function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(' ')
}

/** Make a decision using Claude API */
async function claudeDecision(
  personality: AIPersonality,
  context: GameContext,
  equity: { winRate: number; tieRate: number }
): Promise<AIAction> {
  const client = getClient()
  if (!client) throw new Error('No API key')

  const callAmount = context.currentBet - context.myBet
  const potOdds = calculatePotOdds(callAmount, context.pot)
  const minRaiseTotal = context.currentBet + context.minRaise

  const handEval = context.communityCards.length >= 3
    ? evaluateHand([...context.holeCards, ...context.communityCards])
    : null

  const prompt = `当前牌局信息：
- 你的手牌: ${formatCards(context.holeCards)}
- 公共牌: ${context.communityCards.length > 0 ? formatCards(context.communityCards) : '（无）'}
- 当前阶段: ${context.phase}
- 底池: ${context.pot}
- 当前下注: ${context.currentBet}（你已下注 ${context.myBet}，需要跟注 ${callAmount}）
- 你的筹码: ${context.myChips}
- 最小加注总额: ${minRaiseTotal}
- 对手数量: ${context.numOpponents}
- 你的位置: ${context.position}
${handEval ? `- 当前牌型: ${handEval.handName}` : ''}
- 胜率估算: ${(equity.winRate * 100).toFixed(1)}%
- 底池赔率: ${(potOdds * 100).toFixed(1)}%

最近行动:
${context.actionHistory.slice(-5).join('\n') || '（无）'}

你只能选择以下操作之一，以 JSON 格式回复：
${callAmount === 0 ? '- {"type":"check"}' : ''}
${callAmount > 0 ? `- {"type":"fold"}` : ''}
${callAmount > 0 ? `- {"type":"call"}` : ''}
- {"type":"raise","amount":<总下注金额，必须 >= ${minRaiseTotal}>}
- {"type":"allIn"}

只回复 JSON，不要任何其他文字。`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    system: personality.prompt,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const match = text.match(/\{[^}]+\}/)
    if (match) {
      const action = JSON.parse(match[0]) as AIAction
      return validateAction(action, context)
    }
  } catch {}

  return fallbackDecision(personality, context, equity)
}

/** Rule-based fallback decision when Claude is unavailable */
function fallbackDecision(
  personality: AIPersonality,
  context: GameContext,
  equity: { winRate: number; tieRate: number }
): AIAction {
  const { fallback } = personality
  const callAmount = context.currentBet - context.myBet
  const potOdds = calculatePotOdds(callAmount, context.pot)
  const effectiveEquity = equity.winRate + equity.tieRate * 0.5
  const minRaiseTotal = context.currentBet + context.minRaise

  // No bet to call — check or bet
  if (callAmount === 0) {
    if (effectiveEquity >= fallback.raiseThreshold || Math.random() < fallback.bluffRate) {
      // Raise amount = total bet (currentBet + increment)
      const increment = Math.max(
        context.minRaise,
        Math.round(context.pot * fallback.aggression * (0.5 + Math.random() * 0.5))
      )
      const raiseTotal = context.currentBet + increment
      if (raiseTotal - context.myBet <= context.myChips) {
        return { type: 'raise', amount: raiseTotal }
      }
      return { type: 'allIn' }
    }
    return { type: 'check' }
  }

  // Must call or fold
  if (effectiveEquity >= fallback.raiseThreshold || Math.random() < fallback.bluffRate * 0.5) {
    const increment = Math.max(
      context.minRaise,
      Math.round(context.pot * fallback.aggression * (0.5 + Math.random() * 0.5))
    )
    const raiseTotal = context.currentBet + increment
    if (raiseTotal - context.myBet <= context.myChips) {
      return { type: 'raise', amount: raiseTotal }
    }
    return { type: 'allIn' }
  }

  if (effectiveEquity >= fallback.callThreshold || effectiveEquity > potOdds) {
    if (callAmount >= context.myChips) return { type: 'allIn' }
    return { type: 'call' }
  }

  return { type: 'fold' }
}

/** Validate and clamp an AI action to be legal */
function validateAction(action: AIAction, context: GameContext): AIAction {
  const callAmount = context.currentBet - context.myBet
  const minRaiseTotal = context.currentBet + context.minRaise
  const maxBet = context.myBet + context.myChips

  switch (action.type) {
    case 'check':
      if (callAmount > 0) return { type: 'fold' }
      return action
    case 'call':
      if (callAmount <= 0) return { type: 'check' }
      if (callAmount >= context.myChips) return { type: 'allIn' }
      return action
    case 'raise': {
      let amount = action.amount ?? minRaiseTotal
      if (amount < minRaiseTotal) amount = minRaiseTotal
      if (amount > maxBet) return { type: 'allIn' }
      return { type: 'raise', amount }
    }
    case 'allIn':
      return action
    case 'fold':
      if (callAmount === 0) return { type: 'check' } // Never fold for free
      return action
    default:
      return callAmount > 0 ? { type: 'fold' } : { type: 'check' }
  }
}

/** Main decision function — tries Claude, falls back to rules */
export async function makeDecision(
  personality: AIPersonality,
  context: GameContext
): Promise<AIAction> {
  let equity = { winRate: 0.5, tieRate: 0.02 }

  try {
    equity = calculateEquity(
      context.holeCards,
      context.communityCards,
      context.numOpponents
    )
  } catch (err) {
    console.error('[AI] Equity calculation failed, using default:', err)
  }

  console.log(`[AI] ${context.phase} | equity=${(equity.winRate * 100).toFixed(1)}% | pot=${context.pot} | bet=${context.currentBet} | myBet=${context.myBet} | chips=${context.myChips}`)

  try {
    return await claudeDecision(personality, context, equity)
  } catch (e) {
    console.log(`[AI] Claude unavailable, using fallback:`, (e as Error).message)
    return fallbackDecision(personality, context, equity)
  }
}
