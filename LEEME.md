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
git clone <tu-repo-url>
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

- Nota: al iniciar `npm run server` el backend ejecuta migraciones ligeras: crea las tablas básicas necesarias (`Usuario`, `Carta`, `CartaMazo`, `posee`, `Amigo`, `Mazo`) si no existen y añade la columna `idmazo_predefinido` en `CartaMazo` cuando corresponde. Aun así, para entornos de producción revisa y aplica políticas de backup antes de ejecutar migraciones automáticas.

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

Guardar presets desde frontend
-----------------------------

Ejemplo minimal del body al crear un preset:

```json
{
  "userId": 1,
  "nombremazo": "Mi mazo",
  "cardIds": [12, 12, 7, 3, 3, 3]
}
```

Notas sobre `dist/` y despliegue
--------------------------------

- `dist/` es el artefacto de build del frontend. Para AWS es habitual generar el build (`npm run build`) y luego desplegar el contenido de `dist/` en el servicio elegido (S3 + CloudFront, Elastic Beanstalk, ECS, etc.).
- En este proyecto puedes optar por subir `dist/` al repo (útil para despliegues simples) o ignorarlo y usar CI/CD para construir en el servidor. Si subes `dist/`, recuerda mantenerlo sincronizado con el último `npm run build`.

Scripts útiles
--------------

- `npm run dev` — arranca Vite en modo dev
- `npm run server` — arranca el servidor Express
- `npm run dev:full` — arranca frontend y backend (requiere `concurrently`)
- `npm run build` — genera `dist/`

Consejos para producción
------------------------

- No uses credenciales root en producción; crea un usuario de base de datos con permisos mínimos.
- Haz backups regulares de la base de datos (`mysqldump`).
- Considera controlar las migraciones con una herramienta dedicada (Flyway, Liquibase o migraciones SQL versionadas) en vez de migraciones automáticas en arranque.

Eliminar scripts de diagnóstico
-------------------------------

Si ya no necesitas `scripts/inspectDeckSchema.mjs`, es seguro eliminarlo; solo era una utilidad de inspección (no modifica tablas).

Contribuir
---------

Abre un issue o PR, mantiene ramas limpias y agrega commits claros. Gracias por contribuir.

Licencia
--------
MIT — revisa el repo para añadir archivo `LICENSE` si procede.
