<template>
  <canvas ref="canvas" class="ring-burst" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

/** Celebration burst of small acrylic rings, drawn on a canvas. */
const props = withDefaults(defineProps<{ colors: string[]; count?: number }>(), { count: 110 })

const canvas = ref<HTMLCanvasElement | null>(null)
let frame = 0
let stopped = false

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  thick: number
  color: string
  spin: number
  tilt: number
  life: number
  solid: boolean
}

function resolveColor(el: HTMLElement, value: string): string {
  if (!value.startsWith('var(')) return value
  const name = value.slice(4, -1).split(',')[0].trim()
  return getComputedStyle(el).getPropertyValue(name).trim() || '#ffcf4a'
}

onMounted(() => {
  const el = canvas.value
  if (!el) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const ctx = el.getContext('2d')
  if (!ctx) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const resize = () => {
    el.width = el.clientWidth * dpr
    el.height = el.clientHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()

  const palette = props.colors.map(color => resolveColor(el, color))
  const w = el.clientWidth
  const h = el.clientHeight
  const particles: Particle[] = Array.from({ length: props.count }, (_, index) => {
    const fromLeft = index % 2 === 0
    const angle = (fromLeft ? -Math.PI / 3 : -2 * Math.PI / 3) + (Math.random() - 0.5) * 0.7
    const speed = 9 + Math.random() * 9
    return {
      x: fromLeft ? -10 : w + 10,
      y: h * (0.55 + Math.random() * 0.3),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 4 + Math.random() * 7,
      thick: 0.35 + Math.random() * 0.2,
      color: palette[index % palette.length],
      spin: Math.random() * Math.PI,
      tilt: (Math.random() - 0.5) * 0.25,
      life: 0,
      solid: Math.random() > 0.72,
    }
  })

  const draw = () => {
    if (stopped) return
    ctx.clearRect(0, 0, w, h)
    let alive = 0
    for (const p of particles) {
      p.life++
      p.vy += 0.32
      p.vx *= 0.985
      p.vy *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.spin += p.tilt
      if (p.y > h + 30) continue
      alive++
      const squash = Math.abs(Math.cos(p.spin))
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.scale(1, 0.35 + squash * 0.65)
      ctx.beginPath()
      if (p.solid) {
        ctx.fillStyle = p.color
        ctx.arc(0, 0, p.r * 0.6, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.strokeStyle = p.color
        ctx.lineWidth = p.r * p.thick
        ctx.arc(0, 0, p.r, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }
    if (alive > 0) frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
})

onUnmounted(() => {
  stopped = true
  cancelAnimationFrame(frame)
})
</script>

<style scoped>
.ring-burst {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
