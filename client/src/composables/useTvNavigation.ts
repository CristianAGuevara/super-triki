import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTvModeStore } from '@/stores/tvStore'
import { createPointerDpad, type Direction } from '@/utils/pointerDpad'

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

/**
 * Picks the neighbour in a direction. Elements lined up with the current one
 * (sharing its row or column band) are preferred; anything else has to sit
 * inside a cone around the direction, so "right" doesn't jump to something
 * mostly above. Only when the cone is empty does any element on that side do.
 */
function findNextFocusable(
  current: HTMLElement,
  direction: Direction,
  candidates: HTMLElement[],
): HTMLElement | null {
  const from = current.getBoundingClientRect()
  const origin = centerOf(current)
  const horizontal = direction === 'left' || direction === 'right'
  let best: HTMLElement | null = null
  let bestScore = Number.POSITIVE_INFINITY
  let fallback: HTMLElement | null = null
  let fallbackScore = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (candidate === current) continue
    const rect = candidate.getBoundingClientRect()
    const dx = rect.left + rect.width / 2 - origin.x
    const dy = rect.top + rect.height / 2 - origin.y

    if (direction === 'left' && dx >= -4) continue
    if (direction === 'right' && dx <= 4) continue
    if (direction === 'up' && dy >= -4) continue
    if (direction === 'down' && dy <= 4) continue

    const primary = horizontal ? Math.abs(dx) : Math.abs(dy)
    const secondary = horizontal ? Math.abs(dy) : Math.abs(dx)
    const aligned = horizontal
      ? Math.min(from.bottom, rect.bottom) - Math.max(from.top, rect.top) > 0
      : Math.min(from.right, rect.right) - Math.max(from.left, rect.left) > 0

    const loose = primary + secondary * 1.7
    if (loose < fallbackScore) {
      fallback = candidate
      fallbackScore = loose
    }
    if (!aligned && secondary > primary * 2.5) continue

    const score = aligned ? primary + secondary * 0.4 : loose
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best ?? fallback
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

/** Left/right belong to the text caret until it reaches the end of the text. */
function caretBlocks(field: HTMLInputElement | HTMLTextAreaElement, direction: Direction): boolean {
  if (direction !== 'left' && direction !== 'right') return false
  try {
    const start = field.selectionStart
    const end = field.selectionEnd
    if (start === null || end === null) return false
    if (start !== end) return true
    return direction === 'left' ? start > 0 : end < field.value.length
  } catch {
    // Some input types don't expose a selection.
    return false
  }
}

function isActivatable(element: EventTarget | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  if (element.hasAttribute('data-tv-ok')) return true
  if (element.matches('select, textarea')) return false
  if (isTextEntry(element)) return false
  if (element instanceof HTMLInputElement && element.type === 'range') return false
  return element.matches(
    'button, a[href], summary, [role="button"], input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"]',
  )
}

/** An element that takes OK while it is on screen, whatever has the focus. */
function okOverride(): HTMLElement | null {
  const overrides = Array.from(document.querySelectorAll<HTMLElement>('[data-tv-ok]')).filter(isVisible)
  return overrides[overrides.length - 1] ?? null
}

/** Opens a <select>, or steps to its next option where it can't be opened. */
function openSelect(select: HTMLSelectElement) {
  const picker = (select as HTMLSelectElement & { showPicker?: () => void }).showPicker
  if (typeof picker === 'function') {
    try {
      picker.call(select)
      return
    } catch {
      // Falls through to cycling.
    }
  }
  if (select.options.length === 0) return
  select.selectedIndex = (select.selectedIndex + 1) % select.options.length
  select.dispatchEvent(new Event('input', { bubbles: true }))
  select.dispatchEvent(new Event('change', { bubbles: true }))
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

  /** Moves the focus one step. Returns false when there is nowhere to go. */
  function step(direction: Direction): boolean {
    const active = document.activeElement as HTMLElement | null
    const scope = modalScope() ?? document
    const focusables = focusableElements(scope)
    if (focusables.length === 0) return false

    const next = !active || active === document.body || !focusables.includes(active)
      ? initialFocusable(focusables)
      : findNextFocusable(active, direction, focusables)
    if (!next) return false
    focusElement(next)
    return true
  }

  /** One arrow press: move the focus, or scroll when nothing lies that way. */
  function move(direction: Direction) {
    if (step(direction)) return
    if (direction === 'up' || direction === 'down') {
      window.scrollBy({ top: (direction === 'down' ? 1 : -1) * window.innerHeight * 0.4 })
    }
  }

  /** OK from the keyboard: only taken when there is something to press. */
  function activateFromKey(): boolean {
    const target = okOverride() ?? document.activeElement
    if (!isActivatable(target)) return false
    target.click()
    return true
  }

  /** OK from a press that was taken away from the cursor. */
  function activateFromPointer() {
    const target = okOverride() ?? document.activeElement
    if (isActivatable(target)) {
      target.click()
    } else if (isTextEntry(target)) {
      // Re-focusing inside a real press is what brings up the TV keyboard.
      target.blur()
      target.focus({ preventScroll: true })
    } else if (target instanceof HTMLSelectElement) {
      openSelect(target)
    } else {
      focusInitialIfNeeded()
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!tvStore.enabled || event.defaultPrevented) return
    if (handleBack(event)) return

    if (ACTIVATION_KEYS.has(event.key) || ACTIVATION_KEY_CODES.has(event.keyCode)) {
      if (activateFromKey()) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }

    const direction = KEY_DIRECTIONS[event.key] ?? KEY_CODE_DIRECTIONS[event.keyCode]
    if (!direction) return

    // The remote sends real arrows: from here on the pointer is out.
    tvStore.setInputMode('dpad')

    const active = document.activeElement
    if (isTextEntry(active) && caretBlocks(active, direction)) return

    // Always consumed, so the browser never scrolls the page instead.
    event.preventDefault()
    event.stopPropagation()
    move(direction)
  }

  // ── Browsers that keep the arrows and move their own cursor ──────────
  // The page can't switch that cursor off, but it can read the arrows out
  // of its movement (see pointerDpad) and stop reacting to it as a pointer.
  const pointerDpad = createPointerDpad()

  function handleMouseMove(event: MouseEvent) {
    if (!tvStore.enabled || !event.isTrusted) return
    const signal = pointerDpad.feed(event.screenX, event.screenY, event.timeStamp)
    if (!signal) return
    if (signal.type === 'free') {
      // A hand-held pointer (mouse, air remote): give it back.
      tvStore.setInputMode('pointer')
      return
    }
    tvStore.setInputMode('dpad')
    move(signal.direction)
  }

  function isPointerPress(event: MouseEvent): boolean {
    // detail 0 = a click the browser made from Enter/Space on a control.
    return tvStore.enabled && tvStore.inputMode === 'dpad' && event.isTrusted && event.detail > 0
  }

  function handleMouseDown(event: MouseEvent) {
    if (!isPointerPress(event)) return
    // Keeps the press from moving the focus to wherever the cursor is.
    event.preventDefault()
  }

  function handleClick(event: MouseEvent) {
    if (!isPointerPress(event)) return
    event.preventDefault()
    event.stopPropagation()
    activateFromPointer()
  }

  function handleTouchStart() {
    if (tvStore.enabled) tvStore.setInputMode('pointer')
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('mousemove', handleMouseMove, true)
    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('click', handleClick, true)
    window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true })
    scheduleInitialFocus()
  })

  watch(() => route.fullPath, scheduleInitialFocus)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown, true)
    window.removeEventListener('mousemove', handleMouseMove, true)
    window.removeEventListener('mousedown', handleMouseDown, true)
    window.removeEventListener('click', handleClick, true)
    window.removeEventListener('touchstart', handleTouchStart, true)
  })
}
