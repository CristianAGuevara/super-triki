import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTvModeStore } from '@/stores/tvStore'

type Direction = 'up' | 'down' | 'left' | 'right'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  Up: 'up',
  ArrowDown: 'down',
  Down: 'down',
  ArrowLeft: 'left',
  Left: 'left',
  ArrowRight: 'right',
  Right: 'right',
}

const KEY_CODE_DIRECTIONS: Record<number, Direction> = {
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
}

const BACK_KEYS = new Set(['Escape', 'GoBack', 'BrowserBack', 'Back'])
const BACK_KEY_CODES = new Set([8, 461, 10009])
const ACTIVATION_KEYS = new Set(['Enter', 'Select', 'Accept', 'OK', ' ', 'Spacebar'])
const ACTIVATION_KEY_CODES = new Set([13, 32])

function isVisible(element: HTMLElement): boolean {
  if (element.hasAttribute('data-tv-skip')) return false
  if (element.getAttribute('aria-hidden') === 'true') return false
  if (element.closest('[aria-hidden="true"]')) return false
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false
  }
  return element.getClientRects().length > 0
}

function modalScope(): HTMLElement | null {
  const modals = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]'))
    .filter(isVisible)
  return modals[modals.length - 1] ?? null
}

function focusableElements(scope: HTMLElement | Document): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(isVisible)
    .filter(element => element.getAttribute('aria-disabled') !== 'true')
}

function initialFocusable(all: HTMLElement[]): HTMLElement | null {
  const contentSelectors = [
    '.home__body',
    '.lobby',
    '.tournament__lobby',
    '.tournament__stage',
    '.spectator__main',
    '.tv-controls',
    '.room__main',
    '.room__header',
  ]
  for (const selector of contentSelectors) {
    const root = document.querySelector<HTMLElement>(selector)
    if (!root) continue
    const candidate = all.find(element => root.contains(element))
    if (candidate) return candidate
  }
  return all[0] ?? null
}

function centerOf(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function findNextFocusable(
  current: HTMLElement,
  direction: Direction,
  candidates: HTMLElement[],
): HTMLElement | null {
  const origin = centerOf(current)
  let best: HTMLElement | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (candidate === current) continue
    const center = centerOf(candidate)
    const dx = center.x - origin.x
    const dy = center.y - origin.y
    const horizontal = direction === 'left' || direction === 'right'

    if (direction === 'left' && dx >= -4) continue
    if (direction === 'right' && dx <= 4) continue
    if (direction === 'up' && dy >= -4) continue
    if (direction === 'down' && dy <= 4) continue

    const primary = horizontal ? Math.abs(dx) : Math.abs(dy)
    const secondary = horizontal ? Math.abs(dy) : Math.abs(dx)
    const score = primary + secondary * 1.7

    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best
}

function focusElement(element: HTMLElement) {
  element.focus({ preventScroll: true })
  element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
}

function isTextEntry(element: EventTarget | null): element is HTMLInputElement | HTMLTextAreaElement {
  if (!(element instanceof HTMLElement)) return false
  if (element instanceof HTMLTextAreaElement) return true
  return element instanceof HTMLInputElement &&
    !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(element.type)
}

function isActivatable(element: EventTarget | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  if (element.matches('select, textarea')) return false
  if (isTextEntry(element)) return false
  if (element instanceof HTMLInputElement && element.type === 'range') return false
  return element.matches(
    'button, a[href], summary, [role="button"], input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"]',
  )
}

export function useTvNavigation() {
  const tvStore = useTvModeStore()
  const route = useRoute()

  function focusInitialIfNeeded() {
    if (!tvStore.enabled) return
    const active = document.activeElement as HTMLElement | null
    if (active && active !== document.body && isVisible(active)) return
    const scope = modalScope() ?? document
    const focusables = focusableElements(scope)
    const initial = initialFocusable(focusables)
    if (initial) focusElement(initial)
  }

  function scheduleInitialFocus() {
    void nextTick(() => window.setTimeout(focusInitialIfNeeded, 120))
  }

  function handleBack(event: KeyboardEvent): boolean {
    if (!BACK_KEYS.has(event.key) && !BACK_KEY_CODES.has(event.keyCode)) return false
    const modal = modalScope()
    if (!modal) return false
    const close = modal.querySelector<HTMLElement>('[data-tv-close]')
      ?? modal.querySelector<HTMLElement>('.rules-card__close')
      ?? modal.querySelector<HTMLElement>('button')
    if (!close) return false
    event.preventDefault()
    close.click()
    return true
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!tvStore.enabled || event.defaultPrevented) return
    if (handleBack(event)) return

    if (ACTIVATION_KEYS.has(event.key) || ACTIVATION_KEY_CODES.has(event.keyCode)) {
      const active = document.activeElement
      if (isActivatable(active)) {
        event.preventDefault()
        event.stopPropagation()
        active.click()
        return
      }
    }

    const direction = KEY_DIRECTIONS[event.key] ?? KEY_CODE_DIRECTIONS[event.keyCode]
    if (!direction) return

    const active = document.activeElement as HTMLElement | null
    if (isTextEntry(active) && (direction === 'left' || direction === 'right')) {
      return
    }

    const scope = modalScope() ?? document
    const focusables = focusableElements(scope)
    if (focusables.length === 0) return

    let next: HTMLElement | null
    if (!active || active === document.body || !focusables.includes(active)) {
      next = initialFocusable(focusables)
    } else {
      next = findNextFocusable(active, direction, focusables)
    }

    if (!next) return
    event.preventDefault()
    event.stopPropagation()
    focusElement(next)
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    scheduleInitialFocus()
  })

  watch(() => route.fullPath, scheduleInitialFocus)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown, true)
  })
}
