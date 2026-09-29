import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import RoomView from '@/views/RoomView.vue'
import SpectatorView from '@/views/SpectatorView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',          name: 'home', component: HomeView },
    { path: '/room/:id',  name: 'room', component: RoomView },
    { path: '/spectate/:id', name: 'spectate', component: SpectatorView },
  ],
})
