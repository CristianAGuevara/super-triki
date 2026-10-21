# Super Triki

Juego multijugador en tiempo real para 2 a 4 jugadores. Cada casilla del tablero
3×3 admite tres fichas (grande, mediana y pequeña), por lo que el tablero tiene
27 posiciones.

## Stack

- **Cliente:** Vue 3, TypeScript, Pinia, Vue Router y Vite.
- **Servidor:** Node.js, Express, Socket.IO y TypeScript.
- **Estado compartido:** Upstash Redis (REST + Pub/Sub SSE).
- **Despliegue:** Vercel Services.

Requiere Node.js 22 o superior. Algunas herramientas de desarrollo actuales
recomiendan `22.22.2+`.

## Desarrollo local

```bash
npm install
npm run dev
```

- Cliente: http://localhost:5173
- Servidor: http://localhost:3001
- Healthcheck: http://localhost:3001/health

Sin credenciales de Upstash, el servidor usa estado local. Eso es suficiente
para desarrollo con una sola instancia, pero no para producción distribuida.

## Controles

- **Escritorio:** arrastra una ficha del inventario a una casilla compatible.
- **Móvil:** toca una ficha para seleccionarla; las casillas válidas se resaltan.
  Luego toca una casilla para colocarla. Toca la misma ficha o el botón
  **Cancelar** para deshacer la selección.
- En pantallas táctiles también puedes arrastrar una ficha. El arrastre solo
  comienza tras mover el dedo unos 8 px, para distinguirlo de un toque.
- En la sala de espera cada jugador puede elegir uno de los ocho colores
  disponibles. El color se conserva durante la partida y no puede repetirse
  entre jugadores de la misma sala.

## Variables de entorno

Configura estas variables en Vercel o en tu shell local:

| Variable | Servicio | Descripción |
| --- | --- | --- |
| `KV_REST_API_URL` | server | URL REST de Upstash Redis. |
| `KV_REST_API_TOKEN` | server | Token con permisos de escritura. |
| `FRONTEND_URL` | server | Origen permitido por CORS. En Vercel puede omitirse si el tráfico es del mismo dominio. |
| `VITE_SERVER_URL` | client | Opcional. URL del backend; por defecto usa el mismo origen. |
| `VITE_SOCKET_PATH` | client | Opcional. Ruta de Socket.IO; en Vercel es `/api/socket.io`. |

No uses `KV_REST_API_READ_ONLY_TOKEN` para el servidor: las partidas necesitan
escritura. Las salas guardadas en Redis expiran automáticamente después de
20 minutos sin actividad.

## Comandos

```bash
npm run dev          # cliente + servidor
npm run build        # compila ambos servicios
npm test             # tests de cliente y servidor
npm run verify       # build + tests, igual que CI
```

## Estructura

```text
client/   Aplicación Vue y modo espectador
server/   API Express, Socket.IO, motor de juego y persistencia
.agents/  Skills de agentes usadas durante el desarrollo
```

## Despliegue

El proyecto se despliega como un único proyecto de Vercel con dos servicios:
`client` en `/` y `server` en `/api`. La configuración está en `vercel.json`.
