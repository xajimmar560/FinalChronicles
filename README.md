# Final Chronicles TCG - Configuración

## Estructura del Proyecto

```
├── src/                 # Frontend (React + Vite)
├── server/              # Backend (Express + MySQL)
│   └── server.js      # Servidor API
├── public/             # Archivos estáticos
├── vite.config.js      # Configuración Vite con proxy
├── package.json        # Dependencias del proyecto
└── .env.example        # Ejemplo de variables de entorno
```

## Requisitos Previos

- Node.js v18+
- MySQL en Docker ejecutándose con:
  - Host: `localhost`
  - Puerto: `3306`
  - Usuario: `root`
  - Contraseña: `root`
  - Base de datos: `PROYECTO`

## Instalación

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno (opcional)
Si tu MySQL tiene diferente configuración, copia `.env.example` a `.env` y ajusta los valores:

```bash
cp .env.example .env
```

Luego edita `.env` con tus credenciales reales.

## Ejecución

### Opción A: Ejecutar ambos (frontend + backend) simultáneamente
```bash
npm run dev:full
```

Esto abre:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

### Opción B: Ejecutar por separado

**Terminal 1 - Servidor Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Endpoints de la API

### Perfil del usuario
```
GET /api/users/:id/profile
```

**Respuesta:**
```json
{
  "uid": 1,
  "nombre_usuario": "PlayerOne",
  "guiles": 2450,
  "level": 42,
  "cardsCount": 156
}
```

### Amigos del usuario
```
GET /api/users/:id/friends
```

**Respuesta:**
```json
[
  {
    "uid": 2,
    "nombre_usuario": "Tifa_Lockhart",
    "guiles": 1830,
    "level": 38,
    "status": "Offline",
    "available": true
  }
]
```

### Health check
```
GET /health
```

## Solución de Problemas

### Error: "ECONNREFUSED" en los logs del servidor
- Verifica que MySQL esté ejecutándose: `docker ps`
- Confirma que la BD `PROYECTO` existe en MySQL
- Revisa las credenciales en `.env`

### Error: "Cannot GET /api/users/1/profile"
- Asegúrate de que el servidor está ejecutándose en `http://localhost:3001`
- Verifica que en el navegador puedas acceder a `http://localhost:5173`

### Error: "CORS"
- El servidor tiene CORS habilitado por defecto, no debería haber problemas
- Si persiste, verifica que el proxy en `vite.config.js` esté bien configurado

## Esquema de Base de Datos

El servidor espera estas tablas:

### Usuario
```sql
CREATE TABLE Usuario (
  uid INT PRIMARY KEY AUTO_INCREMENT,
  nombre_usuario VARCHAR(50) NOT NULL,
  Guiles INT DEFAULT 0,
  Nivel INT DEFAULT 1
);
```

### Amigo
```sql
CREATE TABLE Amigo (
  usuario1 INT NOT NULL,
  usuario2 INT NOT NULL,
  PRIMARY KEY (usuario1, usuario2),
  FOREIGN KEY (usuario1) REFERENCES Usuario(uid),
  FOREIGN KEY (usuario2) REFERENCES Usuario(uid)
);
```

### CartaMazo (para contar cartas)
```sql
CREATE TABLE CartaMazo (
  idmazo INT PRIMARY KEY AUTO_INCREMENT,
  idusuario INT NOT NULL,
  idcarta INT NOT NULL,
  FOREIGN KEY (idusuario) REFERENCES Usuario(uid)
);
```

## Próximos Pasos

- [ ] Implementar sistema de estado dinámico para amigos (Online/Offline/In Game)
- [ ] Agregar autenticación de usuarios
- [ ] Crear más endpoints para el juego
- [ ] Implementar WebSocket para actualizaciones en tiempo real
