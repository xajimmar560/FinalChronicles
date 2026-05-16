import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mysql from "mysql2/promise";
import cors from "cors";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Cargar variables de entorno
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(__dirname, "../dist");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

// Configuracion de la conexion a MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "PROYECTO",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(distPath));

const activeSockets = new Map();

function addSocketForUser(userId, socketId) {
  const connections = activeSockets.get(userId) || new Set();
  connections.add(socketId);
  activeSockets.set(userId, connections);
}

function removeSocket(socketId) {
  for (const [userId, connections] of activeSockets.entries()) {
    if (connections.has(socketId)) {
      connections.delete(socketId);
      if (connections.size === 0) {
        activeSockets.delete(userId);
      }
      break;
    }
  }
}

function emitToUser(userId, event, payload) {
  const connections = activeSockets.get(String(userId));
  if (!connections) return;
  connections.forEach((socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, payload);
    }
  });
}

io.on("connection", (socket) => {
  console.log("? Socket connected:", socket.id);

  socket.on("register", ({ userId }) => {
    if (!userId) return;
    addSocketForUser(String(userId), socket.id);
    socket.data.userId = String(userId);
    console.log(`? Registered socket ${socket.id} for user ${userId}`);
  });

  socket.on("disconnect", () => {
    removeSocket(socket.id);
    console.log("? Socket disconnected:", socket.id);
  });
});

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
  console.error("? Error no capturado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// Validar conexion a BD al iniciar
async function ensureRequestTable() {
  const connection = await pool.getConnection();
  await connection.query(`
    CREATE TABLE IF NOT EXISTS SolicitudAmistad (
      idSolicitud INT PRIMARY KEY AUTO_INCREMENT,
      usuario_origen INT NOT NULL,
      usuario_destino INT NOT NULL,
      estado ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
      fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_solicitud (usuario_origen, usuario_destino),
      CONSTRAINT fk_solicitud_origen FOREIGN KEY (usuario_origen) REFERENCES Usuario(uid) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_solicitud_destino FOREIGN KEY (usuario_destino) REFERENCES Usuario(uid) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  connection.release();
}

async function ensureCardInsertTrigger() {
  const testUserId = Number(process.env.DECK_TEST_USER_ID || 1);
  const connection = await pool.getConnection();

  await connection.query("DROP TRIGGER IF EXISTS after_carta_insert_add_to_test_user");
  await connection.query(`
    CREATE TRIGGER after_carta_insert_add_to_test_user
    AFTER INSERT ON Carta
    FOR EACH ROW
    BEGIN
      IF EXISTS (SELECT 1 FROM Usuario WHERE uid = ${testUserId}) THEN
        INSERT IGNORE INTO posee (idusuario, idcarta)
        VALUES (${testUserId}, NEW.idcarta);
      END IF;
    END
  `);

  connection.release();
  
}

async function ensureUserInsertTrigger() {
  const connection = await pool.getConnection();

  await connection.query("DROP TRIGGER IF EXISTS after_usuario_insert_add_ffvii_cards");
  await connection.query(`
    CREATE TRIGGER after_usuario_insert_add_ffvii_cards
    AFTER INSERT ON Usuario
    FOR EACH ROW
    BEGIN
      INSERT IGNORE INTO posee (idusuario, idcarta)
      SELECT NEW.uid, idcarta
      FROM Carta
      WHERE saga = 'Final Fantasy VII';
    END
  `);

  connection.release();
  
}

async function ensureDeckPresetTables() {
  const connection = await pool.getConnection();

  await connection.query(`
    CREATE TABLE IF NOT EXISTS Mazo (
      idmazo INT NOT NULL AUTO_INCREMENT,
      nombremazo VARCHAR(50) NOT NULL,
      propietario INT NOT NULL,
      PRIMARY KEY (idmazo),
      KEY propietariofk (propietario),
      CONSTRAINT propietariofk FOREIGN KEY (propietario) REFERENCES Usuario(uid) ON DELETE RESTRICT ON UPDATE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  try {
    await connection.query(`
      ALTER TABLE Mazo
      MODIFY COLUMN idmazo INT NOT NULL AUTO_INCREMENT
    `);
  } catch (alterError) {
    // Ignorar si ya estaba configurado como AUTO_INCREMENT
  }

  const [existingColumns] = await connection.query(
    "SHOW COLUMNS FROM CartaMazo LIKE 'idmazo_predefinido'"
  );
  if (!existingColumns || existingColumns.length === 0) {
    await connection.query(
      `ALTER TABLE CartaMazo
       ADD COLUMN idmazo_predefinido INT NULL AFTER idusuario`
    );
  }

  try {
    await connection.query(`
      ALTER TABLE CartaMazo
      ADD CONSTRAINT fk_cartamazo_mazo
      FOREIGN KEY (idmazo_predefinido)
      REFERENCES Mazo(idmazo)
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);
  } catch (fkError) {
    // Es posible que la clave ya exista, se puede ignorar.
  }

  connection.release();
  
}

async function ensureBaseTables() {
  const connection = await pool.getConnection();

  await connection.query(`
    CREATE TABLE IF NOT EXISTS Usuario (
      uid INT PRIMARY KEY AUTO_INCREMENT,
      nombre_usuario VARCHAR(120) NOT NULL UNIQUE,
      Guiles INT DEFAULT 0,
      Nivel INT DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS Carta (
      idcarta INT PRIMARY KEY AUTO_INCREMENT,
      saga VARCHAR(120),
      costeprimario INT DEFAULT 0,
      costesecundario INT DEFAULT 0,
      nombre VARCHAR(255),
      Tipo CHAR(1),
      HP INT NULL,
      ATK INT NULL,
      Habilidades TEXT NULL,
      Uso TEXT NULL,
      Efecto TEXT NULL,
      Buff TEXT NULL,
      Imagen VARCHAR(255) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS CartaMazo (
      idmazo INT NULL,
      idcarta INT NOT NULL,
      idusuario INT NOT NULL,
      CartaDuplicada TINYINT(1) DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS posee (
      idusuario INT NOT NULL,
      idcarta INT NOT NULL,
      PRIMARY KEY (idusuario, idcarta)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS Amigo (
      id INT PRIMARY KEY AUTO_INCREMENT,
      usuario1 INT NOT NULL,
      usuario2 INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  connection.release();
}

async function waitForDatabase(retries = 12, delayMs = 2500) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const connection = await pool.getConnection();
      connection.release();
      return;
    } catch (error) {
      console.warn(`? Intento ${attempt}/${retries} para conectar con MySQL fallido: ${error.code || error.message}`);
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

waitForDatabase()
  .then(async () => {
    console.log("? Conexion a MySQL establecida correctamente");
    await ensureBaseTables();
    await ensureRequestTable();
    await ensureCardInsertTrigger();
    await ensureUserInsertTrigger();
    await ensureDeckPresetTables();
  })
  .catch((err) => {
    console.error("? Error de conexion a MySQL:", err.message);
    process.exit(1);
  });

// Rutas

/**
 * GET /api/users/:id/profile
 */
app.get("/api/users/:id/profile", async (req, res) => {
  try {
    const userId = req.params.id;
    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT uid, nombre_usuario, Guiles, Nivel FROM Usuario WHERE uid = ?",
      [userId]
    );

    connection.release();

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const user = rows[0];

    // Contar cartas del usuario
    const [cardsRows] = await pool.query(
      "SELECT COUNT(*) as count FROM posee WHERE idusuario = ?",
      [userId]
    );

    const cardsCount = cardsRows[0]?.count || 0;

    res.json({
      uid: user.uid,
      nombre_usuario: user.nombre_usuario,
      guiles: user.Guiles,
      level: user.Nivel,
      cardsCount: cardsCount,
    });
  } catch (error) {
    console.error("Error en GET /profile:", error.message);
    res.status(500).json({ error: "Error al obtener el perfil" });
  }
});

/**
 * GET /api/users/:id/friends
 */
app.get("/api/users/:id/friends", async (req, res) => {
  try {
    const userId = req.params.id;
    const connection = await pool.getConnection();

    const [friendRelations] = await connection.query(
      `SELECT usuario1, usuario2 FROM Amigo
       WHERE usuario1 = ? OR usuario2 = ?`,
      [userId, userId]
    );

    connection.release();

    if (!friendRelations || friendRelations.length === 0) {
      return res.json([]);
    }

    const friendIds = friendRelations.map((rel) =>
      rel.usuario1 === Number(userId) ? rel.usuario2 : rel.usuario1
    );

    if (friendIds.length === 0) {
      return res.json([]);
    }

    const placeholders = friendIds.map(() => "?").join(",");
    const [friendsData] = await pool.query(
      `SELECT uid, nombre_usuario, Guiles, Nivel FROM Usuario
       WHERE uid IN (${placeholders})`,
      friendIds
    );

    const friends = friendsData.map((friend) => ({
      uid: friend.uid,
      nombre_usuario: friend.nombre_usuario,
      guiles: friend.Guiles,
      level: friend.Nivel,
      status: "Offline",
      available: true,
    }));

    res.json(friends);
  } catch (error) {
    console.error("Error en GET /friends:", error.message);
    res.status(500).json({ error: "Error al obtener amigos" });
  }
});

/**
 * DELETE /api/friends/:friendId
 */
app.delete("/api/friends/:friendId", async (req, res) => {
  try {
    const friendId = req.params.friendId;
    const userId = req.query.userId; // Pasar userId como query param

    if (!userId) {
      return res.status(400).json({ error: "userId requerido" });
    }

    const connection = await pool.getConnection();

    // Eliminar la amistad bidireccional
    const [result] = await connection.query(
      "DELETE FROM Amigo WHERE (usuario1 = ? AND usuario2 = ?) OR (usuario1 = ? AND usuario2 = ?)",
      [userId, friendId, friendId, userId]
    );

    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({ error: "Amistad no encontrada" });
    }

    // Eliminar cualquier solicitud previa entre los usuarios
    await connection.query(
      "DELETE FROM SolicitudAmistad WHERE (usuario_origen = ? AND usuario_destino = ?) OR (usuario_origen = ? AND usuario_destino = ?)",
      [userId, friendId, friendId, userId]
    );

    connection.release();

    // Emitir actualización a ambos usuarios
    emitToUser(userId, "friendListUpdated", { userId });
    emitToUser(friendId, "friendListUpdated", { userId: friendId });

    res.json({ message: "Amigo eliminado" });
  } catch (error) {
    console.error("Error en DELETE /friends:", error.message);
    res.status(500).json({ error: "Error al eliminar amigo" });
  }
});

/*
CREATE TABLE SolicitudAmistad (
  idSolicitud INT PRIMARY KEY AUTO_INCREMENT,
  usuario_origen INT NOT NULL,
  usuario_destino INT NOT NULL,
  estado ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_solicitud (usuario_origen, usuario_destino),
  FOREIGN KEY (usuario_origen) REFERENCES Usuario(uid),
  FOREIGN KEY (usuario_destino) REFERENCES Usuario(uid)
);
*/

/**
 * GET /api/users/:id/requests
 */
app.get("/api/users/:id/requests", async (req, res) => {
  try {
    const userId = req.params.id;
    const connection = await pool.getConnection();

    const [requests] = await connection.query(
      `SELECT sr.idSolicitud, sr.usuario_origen, u.nombre_usuario as origen_nombre, sr.estado, sr.fecha
       FROM SolicitudAmistad sr
       JOIN Usuario u ON u.uid = sr.usuario_origen
       WHERE sr.usuario_destino = ? AND sr.estado = 'pending'
       ORDER BY sr.fecha DESC`,
      [userId]
    );

    connection.release();

    res.json(
      requests.map((request) => ({
        id: request.idSolicitud,
        originId: request.usuario_origen,
        originName: request.origen_nombre,
        status: request.estado,
        createdAt: request.fecha,
      }))
    );
  } catch (error) {
    console.error("Error en GET /requests:", error.message);
    res.status(500).json({ error: "Error al obtener solicitudes" });
  }
});

/**
 * POST /api/friends/request
 */
app.post("/api/friends/request", async (req, res) => {
  try {
    const { originId, targetUsername } = req.body;

    if (!originId || !targetUsername) {
      return res.status(400).json({ error: "originId y targetUsername requeridos" });
    }

    const connection = await pool.getConnection();

    const [targetRows] = await connection.query(
      "SELECT uid FROM Usuario WHERE LOWER(nombre_usuario) = LOWER(?)",
      [targetUsername]
    );

    if (!targetRows || targetRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Target user not found" });
    }

    const targetId = targetRows[0].uid;
    if (targetId === Number(originId)) {
      connection.release();
      return res.status(400).json({ error: "No puedes enviarte amistad a ti mismo" });
    }

    const [friendRows] = await connection.query(
      `SELECT 1 FROM Amigo WHERE (usuario1 = ? AND usuario2 = ?) OR (usuario1 = ? AND usuario2 = ?)`,
      [originId, targetId, targetId, originId]
    );

    if (friendRows.length > 0) {
      connection.release();
      return res.status(409).json({ error: "Ya eres amigo de este usuario" });
    }

    const [existingReq] = await connection.query(
      `SELECT estado FROM SolicitudAmistad
       WHERE (usuario_origen = ? AND usuario_destino = ?) OR (usuario_origen = ? AND usuario_destino = ?)`,
      [originId, targetId, targetId, originId]
    );

    if (existingReq.length > 0) {
      connection.release();
      return res.status(409).json({ error: "Ya existe una solicitud entre estos usuarios" });
    }

    const [result] = await connection.query(
      "INSERT INTO SolicitudAmistad (usuario_origen, usuario_destino) VALUES (?, ?)",
      [originId, targetId]
    );

    const [originRows] = await connection.query(
      "SELECT nombre_usuario FROM Usuario WHERE uid = ?",
      [originId]
    );
    const originName = originRows[0]?.nombre_usuario || "Friend";

    connection.release();

    const requestPayload = {
      id: result.insertId,
      originId: Number(originId),
      originName,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    emitToUser(targetId, "friendRequestReceived", requestPayload);

    res.status(201).json({
      requestId: result.insertId,
      originId,
      targetId,
      status: "pending",
    });
  } catch (error) {
    console.error("Error en POST /friends/request:", error.message);
    res.status(500).json({ error: "Error al crear la solicitud" });
  }
});

/**
 * POST /api/friends/request/:id/respond
 */
app.post("/api/friends/request/:id/respond", async (req, res) => {
  try {
    const requestId = req.params.id;
    const { action, userId } = req.body;

    if (!action || !userId) {
      return res.status(400).json({ error: "action y userId requeridos" });
    }

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ error: "Action inválida" });
    }

    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT usuario_origen, usuario_destino, estado FROM SolicitudAmistad WHERE idSolicitud = ?",
      [requestId]
    );

    if (!rows || rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    const request = rows[0];
    if (request.usuario_destino !== Number(userId)) {
      connection.release();
      return res.status(403).json({ error: "No tienes permiso para responder esta solicitud" });
    }

    if (request.estado !== "pending") {
      connection.release();
      return res.status(400).json({ error: "La solicitud ya fue respondida" });
    }

    if (action === "accept") {
      await connection.query(
        "INSERT INTO Amigo (usuario1, usuario2) VALUES (?, ?)",
        [request.usuario_origen, request.usuario_destino]
      );
      await connection.query(
        "UPDATE SolicitudAmistad SET estado = 'accepted' WHERE idSolicitud = ?",
        [requestId]
      );
      connection.release();

      emitToUser(request.usuario_origen, "friendRequestResponse", {
        requestId: Number(requestId),
        action: "accepted",
        targetId: request.usuario_destino,
      });
      emitToUser(request.usuario_origen, "friendListUpdated", { userId: request.usuario_origen });
      emitToUser(request.usuario_destino, "friendListUpdated", { userId: request.usuario_destino });

      return res.json({ status: "accepted" });
    }

    await connection.query(
      "UPDATE SolicitudAmistad SET estado = 'declined' WHERE idSolicitud = ?",
      [requestId]
    );
    connection.release();

    emitToUser(request.usuario_origen, "friendRequestResponse", {
      requestId: Number(requestId),
      action: "declined",
      targetId: request.usuario_destino,
    });

    res.json({ status: "declined" });
  } catch (error) {
    console.error("Error en POST /friends/request/:id/respond:", error.message);
    res.status(500).json({ error: "Error al responder la solicitud" });
  }
});

/**
 * POST /api/cards
 */
app.post("/api/cards", async (req, res) => {
  try {
    const {
      userId,
      saga,
      costeprimario,
      costesecundario,
      nombre,
      Tipo,
      HP,
      ATK,
      Habilidades,
      Uso,
      Efecto,
      Buff,
      Imagen,
    } = req.body;

    if (Number(userId) !== 1) {
      return res.status(403).json({ error: "Solo el administrador puede crear cartas" });
    }

    if (!nombre || !saga || Tipo === undefined) {
      return res.status(400).json({ error: "Nombre, saga y tipo son requeridos" });
    }

    const typeMap = {
      Criatura: "C",
      Hechizo: "H",
      Recurso: "R",
      Equipamiento: "E",
      C: "C",
      H: "H",
      R: "R",
      E: "E",
    };

    const typeCode = typeMap[Tipo];
    if (!typeCode) {
      return res.status(400).json({ error: "Tipo de carta inválido" });
    }

    if (typeCode === "C" && !Habilidades?.trim()) {
      return res.status(400).json({ error: "Las criaturas deben incluir habilidades" });
    }
    if (typeCode === "H" && !Efecto?.trim()) {
      return res.status(400).json({ error: "Los hechizos deben incluir efecto" });
    }
    if (typeCode === "R" && !Uso?.trim()) {
      return res.status(400).json({ error: "Los recursos deben incluir uso" });
    }
    if (typeCode === "E" && !Buff?.trim()) {
      return res.status(400).json({ error: "El equipamiento debe incluir buff" });
    }

    const connection = await pool.getConnection();

    const [result] = await connection.query(
      `INSERT INTO Carta (saga, costeprimario, costesecundario, nombre, Tipo, HP, ATK, Habilidades, Uso, Efecto, Buff, Imagen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saga,
        costeprimario || 0,
        costesecundario || 0,
        nombre,
        typeCode,
        typeCode === "C" ? HP || 0 : null,
        typeCode === "C" ? ATK || 0 : null,
        typeCode === "C" ? Habilidades || null : null,
        typeCode === "R" ? Uso || null : null,
        typeCode === "H" ? Efecto || null : null,
        typeCode === "E" ? Buff || null : null,
        Imagen || null,
      ]
    );

    connection.release();

    res.status(201).json({ idcarta: result.insertId });
  } catch (error) {
    console.error("Error en POST /cards:", error);
    res.status(500).json({ error: "Error al crear la carta" });
  }
});

/**
 * GET /api/cards
 */
app.get("/api/cards", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT idcarta, saga, costeprimario, costesecundario, nombre, Tipo, HP, ATK, Habilidades, Uso, Efecto, Buff, Imagen
       FROM Carta ORDER BY nombre ASC`
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error en GET /cards:", error.message);
    res.status(500).json({ error: "Error al obtener las cartas" });
  }
});

/**
 * GET /api/users/:id/collection
 */
app.get("/api/users/:id/collection", async (req, res) => {
  try {
    const userId = req.params.id;
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT p.idusuario, p.idcarta, c.saga, c.costeprimario, c.costesecundario, c.nombre, c.Tipo, c.HP, c.ATK, c.Habilidades, c.Uso, c.Efecto, c.Buff, c.Imagen
       FROM posee p
       JOIN Carta c ON p.idcarta = c.idcarta
       WHERE p.idusuario = ?
       ORDER BY c.nombre ASC`,
      [userId]
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error en GET /users/:id/collection:", error.message);
    res.status(500).json({ error: "Error al obtener la colección" });
  }
});

/**
 * GET /api/users/:id/deck
 */
app.get("/api/users/:id/deck", async (req, res) => {
  try {
    const userId = req.params.id;
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT cm.idmazo, cm.idcarta, cm.CartaDuplicada, c.saga, c.costeprimario, c.costesecundario, c.nombre, c.Tipo, c.HP, c.ATK, c.Habilidades, c.Uso, c.Efecto, c.Buff, c.Imagen
       FROM CartaMazo cm
       JOIN Carta c ON cm.idcarta = c.idcarta
       WHERE cm.idusuario = ? AND cm.idmazo_predefinido IS NULL`,
      [userId]
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error en GET /users/:id/deck:", error);
    res.status(500).json({ error: "Error al obtener el mazo" });
  }
});

/**
 * GET /api/users/:id/deck-presets
 */
app.get("/api/users/:id/deck-presets", async (req, res) => {
  try {
    const userId = req.params.id;
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT m.idmazo, m.nombremazo, COUNT(cm.idcarta) AS cartas
       FROM Mazo m
       LEFT JOIN CartaMazo cm ON cm.idmazo_predefinido = m.idmazo
       WHERE m.propietario = ?
       GROUP BY m.idmazo
       ORDER BY m.nombremazo ASC`,
      [userId]
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error en GET /users/:id/deck-presets:", error);
    res.status(500).json({ error: "Error al obtener los mazos predefinidos" });
  }
});

/**
 * GET /api/users/:id/deck-presets/:presetId
 */
app.get("/api/users/:id/deck-presets/:presetId", async (req, res) => {
  try {
    const userId = req.params.id;
    const presetId = req.params.presetId;
    const connection = await pool.getConnection();
    const [presetRows] = await connection.query(
      "SELECT idmazo FROM Mazo WHERE idmazo = ? AND propietario = ?",
      [presetId, userId]
    );

    if (!presetRows || presetRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Mazo predefinido no encontrado" });
    }

    const [rows] = await connection.query(
      `SELECT cm.idmazo, cm.idcarta, cm.CartaDuplicada, c.saga, c.costeprimario, c.costesecundario, c.nombre, c.Tipo, c.HP, c.ATK, c.Habilidades, c.Uso, c.Efecto, c.Buff, c.Imagen
       FROM CartaMazo cm
       JOIN Carta c ON cm.idcarta = c.idcarta
       WHERE cm.idusuario = ? AND cm.idmazo_predefinido = ?`,
      [userId, presetId]
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error en GET /users/:id/deck-presets/:presetId:", error);
    res.status(500).json({ error: "Error al obtener el mazo predefinido" });
  }
});

/**
 * POST /api/users/:id/deck-presets
 */
app.post("/api/users/:id/deck-presets", async (req, res) => {
  try {
    const userId = req.params.id;
    const { userId: bodyUserId, cardIds, nombremazo } = req.body;

    if (!bodyUserId || Number(bodyUserId) !== Number(userId)) {
      return res.status(403).json({ error: "No autorizado para guardar este mazo" });
    }

    if (!nombremazo || !nombremazo.trim() || nombremazo.trim().length < 3) {
      return res.status(400).json({ error: "El nombre del mazo debe tener al menos 3 caracteres" });
    }

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ error: "cardIds debe ser un arreglo con al menos una carta" });
    }

    const cardCount = cardIds.reduce((acc, id) => {
      const key = Number(id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    for (const count of Object.values(cardCount)) {
      if (count > 2) {
        return res.status(400).json({ error: "Máximo 2 copias por carta" });
      }
    }

    if (cardIds.length > 30) {
      return res.status(400).json({ error: "El mazo no puede tener más de 30 cartas" });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      "INSERT INTO Mazo (nombremazo, propietario) VALUES (?, ?)",
      [nombremazo.trim(), userId]
    );

    const presetId = result.insertId;
    const counts = {};
    for (const cardId of cardIds) {
      const numericCardId = Number(cardId);
      const duplicate = counts[numericCardId] ? 1 : 0;
      counts[numericCardId] = (counts[numericCardId] || 0) + 1;
      await connection.query(
        "INSERT INTO CartaMazo (idcarta, idusuario, idmazo_predefinido, CartaDuplicada) VALUES (?, ?, ?, ?)",
        [numericCardId, userId, presetId, duplicate]
      );
    }

    await connection.commit();
    connection.release();

    res.status(201).json({ idmazo: presetId, nombremazo: nombremazo.trim() });
  } catch (error) {
    console.error("Error en POST /users/:id/deck-presets:", error);
    res.status(500).json({ error: "Error al guardar el mazo predefinido" });
  }
});

/**
 * POST /api/users/:id/deck
 */
app.post("/api/users/:id/deck", async (req, res) => {
  try {
    const userId = req.params.id;
    const { userId: bodyUserId, cardIds } = req.body;

    if (!bodyUserId || Number(bodyUserId) !== Number(userId)) {
      return res.status(403).json({ error: "No autorizado para guardar este mazo" });
    }

    if (!Array.isArray(cardIds)) {
      return res.status(400).json({ error: "cardIds debe ser un arreglo" });
    }

    const cardCount = cardIds.reduce((acc, id) => {
      const key = Number(id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    for (const count of Object.values(cardCount)) {
      if (count > 2) {
        return res.status(400).json({ error: "Máximo 2 copias por carta" });
      }
    }

    if (cardIds.length > 30) {
      return res.status(400).json({ error: "El mazo no puede tener más de 30 cartas" });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query("DELETE FROM CartaMazo WHERE idusuario = ? AND idmazo_predefinido IS NULL", [userId]);

    const counts = {};
    for (const cardId of cardIds) {
      const numericCardId = Number(cardId);
      const duplicate = counts[numericCardId] ? 1 : 0;
      counts[numericCardId] = (counts[numericCardId] || 0) + 1;
      await connection.query(
        "INSERT INTO CartaMazo (idcarta, idusuario, idmazo_predefinido, CartaDuplicada) VALUES (?, ?, NULL, ?)",
        [numericCardId, userId, duplicate]
      );
    }

    await connection.commit();
    connection.release();

    res.status(201).json({ saved: true });
  } catch (error) {
    console.error("Error en POST /users/:id/deck:", error);
    res.status(500).json({ error: "Error al guardar el mazo" });
  }
});

/**
 * POST /api/auth/register
 */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      console.warn("?? Registro: faltan credenciales");
      return res.status(400).json({ error: "Usuario y contrasenya requeridos" });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: "El usuario debe tener al menos 3 caracteres" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contrase�a debe tener al menos 6 caracteres" });
    }

    const connection = await pool.getConnection();

    const [existing] = await connection.query(
      "SELECT uid FROM Usuario WHERE nombre_usuario = ?",
      [username]
    );

    if (existing && existing.length > 0) {
      connection.release();
      console.warn(`?? Registro: usuario ${username} ya existe`);
      return res.status(409).json({ error: "El usuario ya existe" });
    }

    const [result] = await connection.query(
      "INSERT INTO Usuario (nombre_usuario, Guiles, Nivel) VALUES (?, ?, ?)",
      [username, 0, 1]
    );

    connection.release();

    console.log(`? Nuevo usuario registrado: ${username} (ID: ${result.insertId})`);

    res.status(201).json({
      uid: result.insertId,
      nombre_usuario: username,
      guiles: 0,
      level: 1,
      cardsCount: 0,
    });
  } catch (error) {
    console.error("Error en POST /register:", error.message);
    res.status(500).json({ error: "Error al registrarse" });
  }
});

/**
 * POST /api/auth/login
 */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      console.warn("?? Login: falta usuario");
      return res.status(400).json({ error: "Usuario requerido" });
    }

    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT uid, nombre_usuario, Guiles, Nivel FROM Usuario WHERE nombre_usuario = ?",
      [username]
    );

    connection.release();

    if (!rows || rows.length === 0) {
      console.warn(`?? Login: usuario ${username} no encontrado`);
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    const user = rows[0];

    const [cardsRows] = await pool.query(
      "SELECT COUNT(*) as count FROM CartaMazo WHERE idusuario = ?",
      [user.uid]
    );

    const cardsCount = cardsRows[0]?.count || 0;

    console.log(`? Login exitoso: ${username} (ID: ${user.uid})`);

    res.json({
      uid: user.uid,
      nombre_usuario: user.nombre_usuario,
      guiles: user.Guiles,
      level: user.Nivel,
      cardsCount: cardsCount,
    });
  } catch (error) {
    console.error("Error en POST /login:", error.message);
    res.status(500).json({ error: "Error al iniciar sesi�n" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", server: "Final Chronicles API" });
});

// Fallback para rutas de cliente en producción
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/socket.io") || req.path === "/health") {
    return next();
  }
  res.sendFile(join(distPath, "index.html"));
});

// 404 para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`?? Servidor API ejecutandose en http://localhost:${PORT}`);
  console.log(`?? Base de datos: PROYECTO (MySQL)`);
  console.log(`?? Endpoints disponibles:`);
  console.log(`   - POST /api/auth/register`);
  console.log(`   - POST /api/auth/login`);
  console.log(`   - GET /api/users/:id/profile`);
  console.log(`   - GET /api/users/:id/friends`);
  console.log(`   - GET /api/users/:id/deck-presets`);
  console.log(`   - GET /api/users/:id/deck-presets/:presetId`);
  console.log(`   - POST /api/users/:id/deck-presets`);
  console.log(`   - GET /api/cards`);
  console.log(`   - POST /api/cards`);
  console.log(`   - GET /api/users/:id/deck`);
  console.log(`   - POST /api/users/:id/deck`);
  console.log(`   - GET /health`);
});

// Manejo de errores no capturados
process.on("unhandledRejection", (reason, promise) => {
  console.error("? Promise rechazada no manejada:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("? Excepcion no capturada:", error);
  process.exit(1);
});
