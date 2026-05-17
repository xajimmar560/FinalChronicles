Final Chronicles
=================

Breve descripción
-----------------

Final Chronicles es una pequeña aplicación de cartas con frontend en React (Vite) y backend en Express + MySQL. Permite registro/login, gestionar colección de cartas, construir mazos y guardar mazos predefinidos en la base de datos.

Requisitos
----------

- Node.js (>=16 recomendado)
- npm
- MySQL (o MariaDB) accesible desde la máquina donde se ejecute el servidor

Instalación rápida (desarrollo)
--------------------------------

1. Clona el repo y entra al directorio del proyecto:

```bash
git clone <https://github.com/xajimmar560/FinalChronicles>
cd final_chronicles
```

2. Instala dependencias:

```bash
npm install
```

3. Crea un archivo `.env` en la raíz con al menos estas variables (ajusta según tu entorno):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=PROYECTO
FRONTEND_ORIGIN=http://localhost:5173
DECK_TEST_USER_ID=1
```

4. Levanta la aplicación:

- Backend (API):
```bash
npm run server
```

- Frontend (desarrollo):
```bash
npm run dev
```

- Todo en una terminal (concurrently):
```bash
npm run dev:full
```

Base de datos
-------------

- Si necesitas crear la base de datos manualmente:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS PROYECTO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
```

- Nota: al iniciar `npm run server` el backend ejecuta migraciones ligeras: crea las tablas básicas necesarias (`Usuario`, `Carta`, `CartaMazo`, `posee`, `Amigo`, `Mazo`) si no existen y añade la columna `idmazo_predefinido` en `CartaMazo` cuando corresponde.

APIs principales
----------------

- POST `/api/auth/register` — registrar usuario
- POST `/api/auth/login` — iniciar sesión
- GET `/api/users/:id/profile` — perfil de usuario
- GET `/api/users/:id/collection` — colección del usuario
- GET `/api/cards` — catálogo de cartas
- GET `/api/users/:id/deck` — obtener mazo actual (no presets)
- POST `/api/users/:id/deck` — guardar mazo actual
- GET `/api/users/:id/deck-presets` — listar presets del usuario
- POST `/api/users/:id/deck-presets` — crear preset
  - body: `{ userId, nombremazo, cardIds: [id1, id2, ...] }`
- GET `/api/users/:id/deck-presets/:presetId` — cargar preset

--------------------------------

Scripts útiles
--------------

- `npm run dev` — arranca Vite en modo dev
- `npm run server` — arranca el servidor Express
- `npm run dev:full` — arranca frontend y backend (requiere `concurrently`)
- `npm run build` — genera `dist/`

Docker (opcional)
-----------------

Se incluye configuración de `Docker` y `docker-compose` para desarrollo local o despliegues sencillos.

Construir y levantar (incluye MySQL):

```bash
docker compose build
docker compose up -d
```

El frontend quedará disponible en `http://localhost:8080` y la API en `http://localhost:3001` (según `docker-compose.yml`).

En el despliegue AWS, el frontend está configurado para apuntar a la API pública en `http://35.174.175.48:3001`.

Para detener y limpiar:

```bash
docker compose down
```

Notas:
- Los ficheros relevantes son `Dockerfile` (front), `server/Dockerfile` (API) y `docker-compose.yml`.
- Reemplaza las credenciales de MySQL del compose por valores seguros en producción.

