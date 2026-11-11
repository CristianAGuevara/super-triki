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

## Identidad de sesión

Cada navegador guarda un identificador persistente en `localStorage`. Ese ID se
envía al crear o unirse a una sala o torneo y el servidor rechaza una segunda
conexión de la misma identidad en la misma sala o torneo. Así se evita que una
misma sesión ocupe dos plazas por abrir otra pestaña. La reconexión legítima
sigue usando el token de sesión y recupera la plaza existente.

## Conexión

La aplicación mantiene la conexión con el servidor y comprueba periódicamente
que siga activa. Si se pierde, aparece un aviso global con el motivo y un botón
para reintentar. Salas y torneos se recuperan automáticamente sin recargar la
página; si la sesión se abrió en otra pestaña, el aviso permite decidir cuándo
volver a conectarla.

Para ocultar el cierre de 300 segundos de Vercel Hobby, el cliente renueva el
socket de forma programada entre los 3:30 y 4:00 minutos. El servidor mantiene
un margen de 3 segundos antes de anunciar una desconexión, de modo que el relevo
normalmente pasa inadvertido. Los tiempos se pueden ajustar con
`VITE_SOCKET_ROTATE_MS` y `VITE_SOCKET_ROTATE_JITTER_MS`.

## Torneos

Desde el menú principal se puede crear un torneo de hasta **50 jugadores** o
unirse con un código. En la sala de espera, el anfitrión elige el formato:

- **Eliminación directa:** el ganador de cada grupo avanza hasta la final.
- **Todos contra todos (liga):** todos juegan todas las rondas, sin eliminarse.
  Se puede elegir entre 1 y 10 rondas. Victoria = 3 puntos, empate = 1 punto.
  Los grupos se mezclan en cada ronda para variar los rivales.
  Si al terminar la liga hay empate en el liderato, los empatados juegan una
  **muerte súbita** hasta que quede un único campeón.

Al iniciar, los jugadores se reparten priorizando grupos de 4 y después grupos de
3; solo se usa un grupo de 2 cuando es inevitable, como ocurre con 5 jugadores
(3 + 2). Los empates de una partida de eliminación se pueden repetir.

Las partidas de torneo usan un **reloj total por jugador** elegido por el
anfitrión (3, 5, 8, 10 o 15 minutos). Solo corre el reloj del jugador que tiene
el turno. Al agotarse, ese jugador queda fuera de la partida y el resto continúa;
si queda uno solo, gana el grupo. La duración máxima de un grupo es el tiempo por
jugador multiplicado por sus integrantes.

Cuando termina una ronda, cada jugador clasificado debe pulsar **Listo**. La
siguiente ronda empieza automáticamente cuando todos los clasificados confirman;
ningún jugador puede iniciarla por su cuenta. Mientras se espera, se muestra el
tablero final de la última partida, con la jugada ganadora resaltada.

Desde la sala del torneo se pueden ver las partidas de otros grupos. Mientras
alguien está espectando, aparece un icono de ojo con el número de espectadores
únicos. Al terminar la partida observada, el espectador vuelve automáticamente a
la sala del torneo.

Los torneos públicos aparecen en el listado del menú principal, diferenciados de
las salas y filtrables por tipo.

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
