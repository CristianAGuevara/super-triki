export type Size = 'large' | 'medium' | 'small'

export const SIZE_ORDER: Size[] = ['large', 'medium', 'small']

// Keep these ids in sync with server/src/types/game.ts.
export const PLAYER_COLORS = [
  { id: 'coral',    label: 'Coral',     cssVar: '--player-color-coral' },
  { id: 'cyan',     label: 'Cian',      cssVar: '--player-color-cyan' },
  { id: 'magenta',  label: 'Magenta',   cssVar: '--player-color-magenta' },
  { id: 'amber',    label: 'Ámbar',     cssVar: '--player-color-amber' },
  { id: 'emerald',  label: 'Esmeralda', cssVar: '--player-color-emerald' },
  { id: 'violet',   label: 'Violeta',   cssVar: '--player-color-violet' },
  { id: 'orange',   label: 'Naranja',   cssVar: '--player-color-orange' },
  { id: 'blue',     label: 'Azul',      cssVar: '--player-color-blue' },
] as const

export type PlayerColorId = typeof PLAYER_COLORS[number]['id']
export type PlayerColorOption = typeof PLAYER_COLORS[number]

/** Defaults keep the four seats visually distinct when nobody has chosen yet. */
export const DEFAULT_PLAYER_COLOR_IDS: Record<number, PlayerColorId> = {
  1: 'coral',
  2: 'cyan',
  3: 'magenta',
  4: 'amber',
}

export function getPlayerColorOption(
  id: PlayerColorId | undefined,
  slot: number,
): PlayerColorOption {
  return PLAYER_COLORS.find(color => color.id === id)
    ?? PLAYER_COLORS.find(color => color.id === DEFAULT_PLAYER_COLOR_IDS[slot])
    ?? PLAYER_COLORS[0]
}

export function resolvePlayerColorId(
  id: PlayerColorId | undefined,
  slot: number,
): PlayerColorId {
  return getPlayerColorOption(id, slot).id
}

export function playerColorCss(id: PlayerColorId | undefined, slot: number): string {
  return `var(${getPlayerColorOption(id, slot).cssVar})`
}

// Numeric so expanding to 3 or 4 players requires zero type changes
export type Player = number

export interface GameSettings {
  turnTimerEnabled: boolean
  turnDurationSeconds: number
  removePieceOnTimeout: boolean
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  turnTimerEnabled: false,
  turnDurationSeconds: 90,
  removePieceOnTimeout: false,
}

export interface Piece {
  id: string
  player: Player
  size: Size
}

export interface LastMove {
  pieceId: string
  player: Player
  row: number
  col: number
  size: Size
}

export interface PieceEntrySource {
  left: number
  top: number
  width: number
  height: number
}

export interface Cell {
  large: Piece | null
  medium: Piece | null
  small: Piece | null
}

export type Board = Cell[][]

export type CellCoord = [number, number]

export type Line = CellCoord[]

export interface WinResult {
  winner: Player
  condition: 'same-size' | 'ordered-sequence' | 'complete-cell'
  highlights: Array<{ coord: CellCoord; size: Size }>
}

export interface DragPayload {
  pieceId: string
  player: Player
  size: Size
  source: 'inventory' | 'board'
  /** Index of the concentric stack the piece belongs to in the inventory. */
  setIndex?: number
}
