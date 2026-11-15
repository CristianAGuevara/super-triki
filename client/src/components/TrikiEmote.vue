<!--
  Triki, the game's mascot: a chibi kid whose two hair buns are game rings
  (one cyan, one pink) and who wears a violet hoodie with a gold ring on it.
  Triki acts out every emote and looks the same in every theme: all of its
  colours are fixed here on purpose, none come from theme tokens.
-->
<template>
  <svg
    class="triki"
    :class="[`triki--${emote}`, { 'triki--animated': animated }]"
    viewBox="0 0 100 100"
    aria-hidden="true"
    focusable="false"
  >
    <!-- Things floating around Triki -->
    <g v-if="emote === 'sleepy'" class="triki__fx triki__zzz">
      <text x="76" y="30" font-size="16">Z</text>
      <text x="88" y="18" font-size="11">z</text>
    </g>
    <g v-if="emote === 'love'" class="triki__fx triki__hearts">
      <path class="triki__heart" transform="translate(80 30) scale(0.5)" :d="HEART" />
      <path class="triki__heart" transform="translate(4 34) scale(0.38)" :d="HEART" />
    </g>
    <g v-if="emote === 'angry'" class="triki__fx triki__steam">
      <path d="M10 44c-5-1-7-6-4-10M6 54c-4 1-7-2-6-6" />
      <path d="M90 44c5-1 7-6 4-10M94 54c4 1 7-2 6-6" />
    </g>
    <g v-if="emote === 'cool'" class="triki__fx triki__sparkle">
      <path d="M89 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
    </g>
    <g v-if="emote === 'happy'" class="triki__fx triki__sparkle">
      <path d="M90 34l1.500 4.500 4.500 1.500-4.500 1.500-1.500 4.500-1.500-4.500-4.500-1.500 4.500-1.500z" />
      <path d="M9 36l1.200 3.600 3.600 1.200-3.600 1.200-1.200 3.600-1.200-3.600-3.600-1.200 3.600-1.200z" />
    </g>
    <g v-if="emote === 'buzz'" class="triki__fx triki__waves">
      <path d="M9 40l-6 6 6 6-6 6 6 6M91 40l6 6-6 6 6 6-6 6" />
    </g>

    <g class="triki__body">
      <!-- Hoodie -->
      <path class="triki__hoodie" d="M31 99c-1-13 6-20 19-20s20 7 19 20z" />
      <circle class="triki__emblem" cx="50" cy="91" r="4" />

      <!-- Ring buns -->
      <circle class="triki__bun-edge" cx="21" cy="25" r="11" />
      <circle class="triki__bun triki__bun--cyan" cx="21" cy="25" r="11" />
      <circle class="triki__bun-edge" cx="79" cy="25" r="11" />
      <circle class="triki__bun triki__bun--pink" cx="79" cy="25" r="11" />

      <!-- Head -->
      <ellipse class="triki__hair" cx="50" cy="48" rx="37" ry="34" />
      <ellipse class="triki__skin" cx="50" cy="53" rx="30" ry="27" />
      <!-- Fringe -->
      <path class="triki__fringe" d="M17 50c-3-22 12-36 33-36s36 14 33 36c-4-7-9-11-15-13l-3 8-7-10-8 9-6-9-8 8-3-7c-7 3-12 8-16 14z" />
      <path class="triki__shine" d="M30 24c5-4 11-6 18-6" />
      <!-- A loose strand on top -->
      <path class="triki__strand" d="M50 15c-1-7 3-11 9-11" />

      <ellipse v-if="emote !== 'buzz'" class="triki__cheek" cx="29" cy="65" rx="6" ry="3.500" />
      <ellipse v-if="emote !== 'buzz'" class="triki__cheek" cx="71" cy="65" rx="6" ry="3.500" />

      <!-- Faces -->
      <g v-if="emote === 'happy'">
        <path class="triki__line" d="M31 58q6-9 12 0M57 58q6-9 12 0" />
        <path class="triki__mouth" d="M42 67h16a8 8 0 0 1-16 0z" />
        <path class="triki__tongue" d="M46 72.500a5 4 0 0 1 8 0 7 7 0 0 1-8 0z" />
      </g>

      <g v-else-if="emote === 'angry'">
        <path class="triki__flush" d="M22 52h56v8H22z" />
        <path class="triki__line triki__line--thick" d="M28 49l15 6M72 49l-15 6" />
        <path class="triki__ink" d="M31 57h11a5.500 5.500 0 0 1-11 0zM58 57h11a5.500 5.500 0 0 1-11 0z" />
        <path class="triki__mouth" d="M42 73q8-9 16 0z" />
        <path class="triki__vein" d="M66 22v9M61.500 26.500h9M62 20l4 4M70 33l-4-4" />
      </g>

      <g v-else-if="emote === 'sleepy'">
        <path class="triki__line" d="M30 58q6 6 13 0M57 58q6 6 13 0" />
        <ellipse class="triki__ink" cx="50" cy="71" rx="3.500" ry="4" />
        <circle class="triki__bubble" cx="61" cy="72" r="6.500" />
      </g>

      <g v-else-if="emote === 'crying'">
        <path class="triki__line" d="M28 51q7-4 13 0M59 51q6-4 13 0" />
        <path class="triki__tear" d="M30 59h13v20q-6.500 5-13 0z" />
        <path class="triki__tear" d="M57 59h13v20q-6.500 5-13 0z" />
        <path class="triki__line" d="M30 59q6.500 5 13 0M57 59q6.500 5 13 0" />
        <path class="triki__mouth" d="M43 76a7 7 0 0 1 14 0q-7 3-14 0z" />
      </g>

      <g v-else-if="emote === 'love'">
        <!-- The <g> places each eye; the path inside is what beats. -->
        <g transform="translate(27 49) scale(0.75)"><path class="triki__heart triki__heart--eye" :d="HEART" /></g>
        <g transform="translate(55 49) scale(0.75)"><path class="triki__heart triki__heart--eye" :d="HEART" /></g>
        <path class="triki__line" d="M42 71q4 5 8 0q4 5 8 0" />
      </g>

      <g v-else-if="emote === 'cool'">
        <path class="triki__shades" d="M21 50h58v5q0 11-11 11h-6q-8 0-10-9h-4q-2 9-10 9h-6q-11 0-11-11z" />
        <path class="triki__shades-glint" d="M28 54l7 8M34 54l4 5M60 54l7 8M66 54l4 5" />
        <path class="triki__line" d="M43 73q9 6 16-3" />
      </g>

      <g v-else>
        <circle class="triki__white" cx="36" cy="58" r="8.500" />
        <circle class="triki__white" cx="64" cy="58" r="8.500" />
        <path class="triki__line triki__line--thin" d="M31.500 58a4.500 4.500 0 1 1 4.500 4.500 2.500 2.500 0 1 1 0-5" />
        <path class="triki__line triki__line--thin" d="M59.500 58a4.500 4.500 0 1 1 4.500 4.500 2.500 2.500 0 1 1 0-5" />
        <path class="triki__line" d="M38 74l4-4 4 4 4-4 4 4 4-4 4 4" />
      </g>

    </g>
  </svg>
</template>

<script setup lang="ts">
import type { EmoteId } from '@/types/socket'

withDefaults(defineProps<{
  emote: EmoteId
  /** Plays the emote's little loop (off for the static icons in the wheel). */
  animated?: boolean
}>(), { animated: false })

/** A 24×21 heart, reused for the eyes and the floating hearts. */
const HEART = 'M12 21C5 15 1 11 1 6.500C1 3.400 3.400 1 6.500 1C8.600 1 10.600 2.100 12 4C13.400 2.100 15.400 1 17.500 1C20.600 1 23 3.400 23 6.500C23 11 19 15 12 21Z'
</script>

<style scoped>
/* Fixed palette: Triki is the same character in every theme. */
.triki {
  --ink: #1d1436;
  --hair: #3a2a80;
  --hair-light: #5b46b8;
  --skin: #ffe1cc;
  --hoodie: #7c4dff;
  --gold: #ffd43b;
  --ring-cyan: #22e8ff;
  --ring-pink: #ff2e97;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  /* A thin white sticker edge, so the dark outline reads on dark surfaces. */
  filter: drop-shadow(0 0 0.8px #fff) drop-shadow(0 0 0.8px #fff);
}

.triki__hoodie { fill: var(--hoodie); stroke: var(--ink); stroke-width: 2.500; stroke-linejoin: round; }
.triki__emblem { fill: none; stroke: var(--gold); stroke-width: 2.500; }

.triki__bun-edge { fill: none; stroke: var(--ink); stroke-width: 11; }
.triki__bun { fill: none; stroke-width: 6.500; }
.triki__bun--cyan { stroke: var(--ring-cyan); }
.triki__bun--pink { stroke: var(--ring-pink); }

.triki__hair { fill: var(--hair); stroke: var(--ink); stroke-width: 2.500; }
.triki__skin { fill: var(--skin); }
.triki__fringe { fill: var(--hair); stroke: var(--ink); stroke-width: 2; stroke-linejoin: round; }
.triki__shine { fill: none; stroke: var(--hair-light); stroke-width: 3.500; stroke-linecap: round; }
.triki__strand { fill: none; stroke: var(--ink); stroke-width: 6; stroke-linecap: round; }

.triki__cheek { fill: #ff6f91; opacity: 0.6; }
.triki__flush { fill: #ff3b30; opacity: 0.28; }

.triki__ink { fill: var(--ink); }
.triki__white { fill: #fff; stroke: var(--ink); stroke-width: 2.500; }

.triki__line {
  fill: none;
  stroke: var(--ink);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.triki__line--thick { stroke-width: 5.500; }
.triki__line--thin { stroke-width: 2.400; }

.triki__mouth { fill: #7a1f3d; stroke: var(--ink); stroke-width: 3; stroke-linejoin: round; }
.triki__tongue { fill: #ff7d95; }

.triki__vein { fill: none; stroke: #ff3b30; stroke-width: 3.500; stroke-linecap: round; }
.triki__steam { fill: none; stroke: #fff; stroke-width: 4; stroke-linecap: round; }

.triki__zzz text {
  fill: #fff;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-weight: 800;
  paint-order: stroke;
  stroke: var(--ink);
  stroke-width: 3.500;
}

.triki__bubble {
  fill: rgba(170, 228, 255, 0.7);
  stroke: #fff;
  stroke-width: 1.500;
  transform-box: fill-box;
  transform-origin: 0% 50%;
}

.triki__tear { fill: #5ac8ff; stroke: #fff; stroke-width: 1.500; stroke-linejoin: round; }

.triki__heart { fill: #ff2e63; stroke: #fff; stroke-width: 2; stroke-linejoin: round; }
.triki__heart--eye { stroke: var(--ink); stroke-width: 2.600; transform-box: fill-box; transform-origin: center; }

.triki__shades { fill: #0b0b12; stroke: #0b0b12; stroke-width: 3; stroke-linejoin: round; }
.triki__shades-glint { fill: none; stroke: #fff; stroke-width: 2.200; stroke-linecap: round; opacity: 0.85; }
.triki__sparkle { fill: #fff3a8; stroke: #fff; stroke-width: 1; }

.triki__waves {
  fill: none;
  stroke: var(--gold);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ── The little loops ── */
.triki__body,
.triki__fx {
  transform-box: view-box;
  transform-origin: 50% 95%;
}

.triki--animated.triki--happy .triki__body { animation: triki-bounce 0.55s ease-in-out infinite; }
.triki--animated.triki--happy .triki__sparkle { animation: triki-twinkle 0.7s ease-in-out infinite; }
.triki--animated.triki--angry .triki__body { animation: triki-fume 0.16s linear infinite; }
.triki--animated.triki--angry .triki__steam { animation: triki-puff 0.7s ease-out infinite; }
.triki--animated.triki--sleepy .triki__body { animation: triki-doze 2.200s ease-in-out infinite; }
.triki--animated.triki--sleepy .triki__zzz { animation: triki-float 1.600s ease-in-out infinite; }
.triki--animated.triki--sleepy .triki__bubble { animation: triki-bubble 2.200s ease-in-out infinite; }
.triki--animated.triki--crying .triki__body { animation: triki-sob 0.4s ease-in-out infinite; }
.triki--animated.triki--crying .triki__tear { animation: triki-stream 0.35s linear infinite; }
.triki--animated.triki--love .triki__body { animation: triki-sway 1.100s ease-in-out infinite; }
.triki--animated.triki--love .triki__heart--eye { animation: triki-beat 0.6s ease-in-out infinite; }
.triki--animated.triki--love .triki__hearts { animation: triki-float 1.400s ease-in-out infinite; }
.triki--animated.triki--cool .triki__body { animation: triki-nod 1.200s ease-in-out infinite; }
.triki--animated.triki--cool .triki__sparkle { animation: triki-twinkle 1.200s ease-in-out infinite; }
.triki--animated.triki--buzz .triki__body { animation: triki-buzz 0.09s linear infinite; }
.triki--animated.triki--buzz .triki__waves { animation: triki-twinkle 0.3s linear infinite; }

@keyframes triki-bounce {
  0%, 100% { transform: translateY(0) scale(1, 1); }
  45% { transform: translateY(-8px) scale(0.97, 1.04); }
  80% { transform: translateY(0) scale(1.05, 0.94); }
}

@keyframes triki-fume {
  0%, 100% { transform: translateX(-1.500px); }
  50% { transform: translateX(1.500px); }
}

@keyframes triki-puff {
  0% { opacity: 0; transform: translateY(6px) scale(0.85); }
  40% { opacity: 0.95; }
  100% { opacity: 0; transform: translateY(-8px) scale(1.1); }
}

@keyframes triki-doze {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(-9deg) translateY(1px); }
}

@keyframes triki-float {
  0% { opacity: 0; transform: translateY(8px); }
  35%, 70% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-8px); }
}

@keyframes triki-bubble {
  0%, 100% { transform: scale(0.35); }
  50% { transform: scale(1.15); }
}

@keyframes triki-sob {
  0%, 100% { transform: translateY(0) scale(1, 1); }
  50% { transform: translateY(2px) scale(1.03, 0.96); }
}

@keyframes triki-stream {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.72; }
}

@keyframes triki-sway {
  0%, 100% { transform: rotate(-6deg); }
  50% { transform: rotate(6deg); }
}

@keyframes triki-beat {
  0%, 100% { transform: scale(1); }
  40% { transform: scale(1.25); }
}

@keyframes triki-nod {
  0%, 60%, 100% { transform: rotate(0deg); }
  75% { transform: rotate(-9deg); }
  88% { transform: rotate(3deg); }
}

@keyframes triki-twinkle {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
}

@keyframes triki-buzz {
  0% { transform: translate(-2.500px, 1px) rotate(-2deg); }
  50% { transform: translate(2.500px, -1px) rotate(2deg); }
  100% { transform: translate(-2.500px, 1px) rotate(-2deg); }
}
</style>
