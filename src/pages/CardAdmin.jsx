import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./CardAdmin.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const imageOptions = [
  "aerith.png",
  "barret.png",
  "cloud.png",
  "hoja-artema.png",
  "materia-automejora.png",
  "materia-de-prisa.png",
  "materia-eolica.png",
  "materia-gelida.png",
  "materia-potenciadora.png",
  "materia-vital.png",
  "redxiii.png",
  "sephiroth.png",
  "tifa.png",
];

const initialForm = {
  saga: "Final Fantasy VII",
  costeprimario: 1,
  costesecundario: 0,
  nombre: "",
  Tipo: "Criatura",
  HP: 0,
  ATK: 0,
  Habilidades: "",
  Uso: "",
  Efecto: "",
  Buff: "",
  Imagen: "cloud.png",
};

export default function CardAdmin() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const isCreature = form.Tipo === "Criatura";
  const isSpell = form.Tipo === "Hechizo";
  const isResource = form.Tipo === "Recurso";
  const isEquipment = form.Tipo === "Equipamiento";

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "Tipo") {
      const nextType = value;
      setForm((prev) => ({
        ...prev,
        Tipo: nextType,
        Uso: nextType === "Recurso" ? prev.Uso : "",
        Efecto: nextType === "Hechizo" ? prev.Efecto : "",
        Buff: nextType === "Equipamiento" ? prev.Buff : "",
        Habilidades: nextType === "Criatura" ? prev.Habilidades : "",
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }

    setError(null);
    setStatus(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    setStatus(null);

    try {
      if (form.Tipo === "Hechizo" && !form.Efecto.trim()) {
        throw new Error("El campo efecto es obligatorio para hechizos");
      }

      if (form.Tipo === "Criatura" && !form.Habilidades.trim()) {
        throw new Error("Las criaturas deben incluir habilidades");
      }

      if (form.Tipo === "Recurso" && !form.Uso.trim()) {
        throw new Error("El campo uso es obligatorio para recursos");
      }

      if (form.Tipo === "Equipamiento" && !form.Buff.trim()) {
        throw new Error("El campo buff es obligatorio para equipamiento");
      }

      const response = await fetch(`${BASE_URL}/api/cards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          saga: form.saga,
          costeprimario: Number(form.costeprimario),
          costesecundario: Number(form.costesecundario),
          nombre: form.nombre,
          Tipo: form.Tipo,
          HP: isCreature ? Number(form.HP) : null,
          ATK: isCreature ? Number(form.ATK) : null,
          Habilidades: isCreature ? form.Habilidades || null : null,
          Uso: isResource ? form.Uso || null : null,
          Efecto: isSpell ? form.Efecto || null : null,
          Buff: isEquipment ? form.Buff || null : null,
          Imagen: form.Imagen,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo crear la carta");
      }

      setStatus(`Carta creada con ID ${data.idcarta}`);
      setForm(initialForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!user || Number(user.uid) !== 1) {
    return (
      <main className="card-admin-page">
        <div className="admin-panel p-4 rounded-4 shadow-sm">
          <h2>Acceso denegado</h2>
          <p>Solo el usuario administrador puede crear cartas aquí.</p>
          <button className="btn btn-secondary" onClick={() => navigate("/")}>Volver al inicio</button>
        </div>
      </main>
    );
  }

  return (
    <main className="card-admin-page">
      <div className="admin-panel p-4 rounded-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <p className="page-title mb-1">Administración de Cartas</p>
            <p className="text-muted">Crear nuevas cartas y asignarlas automáticamente a la colección del usuario de prueba.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate("/")}>Volver</button>
        </div>

        <form onSubmit={handleSubmit} className="card-form row gy-3">
          <div className="col-md-6">
            <label className="form-label">Nombre de la carta</label>
            <input
              className="form-control"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Ej. Cloud Strife"
              required
            />
          </div>

          <div className="col-md-6">
            <label className="form-label">Saga</label>
            <input
              className="form-control"
              name="saga"
              value={form.saga}
              onChange={handleChange}
              required
            />
          </div>

          <div className="col-md-4">
            <label className="form-label">Coste primario</label>
            <input
              type="number"
              className="form-control"
              name="costeprimario"
              value={form.costeprimario}
              onChange={handleChange}
              min="0"
              required
            />
          </div>

          <div className="col-md-4">
            <label className="form-label">Coste secundario</label>
            <input
              type="number"
              className="form-control"
              name="costesecundario"
              value={form.costesecundario}
              onChange={handleChange}
              min="0"
            />
          </div>

          <div className="col-md-4">
            <label className="form-label">Tipo</label>
            <select className="form-select" name="Tipo" value={form.Tipo} onChange={handleChange}>
              <option value="Criatura">Criatura</option>
              <option value="Hechizo">Hechizo</option>
              <option value="Equipamiento">Equipamiento</option>
              <option value="Recurso">Recurso</option>
            </select>
          </div>

          <div className="col-md-4">
            <label className="form-label">HP</label>
            <input
              type="number"
              className="form-control"
              name="HP"
              value={form.HP}
              onChange={handleChange}
              min="0"
            />
          </div>

          <div className="col-md-4">
            <label className="form-label">ATK</label>
            <input
              type="number"
              className="form-control"
              name="ATK"
              value={form.ATK}
              onChange={handleChange}
              min="0"
            />
          </div>

          <div className="col-md-4">
            <label className="form-label">Imagen</label>
            <select className="form-select" name="Imagen" value={form.Imagen} onChange={handleChange}>
              {imageOptions.map((img) => (
                <option key={img} value={img}>{img}</option>
              ))}
            </select>
          </div>

          <div className="col-12">
            <label className="form-label">Selecciona una imagen</label>
            <div className="image-picker d-flex flex-wrap gap-2">
              {imageOptions.map((img) => (
                <button
                  type="button"
                  key={img}
                  className={`image-option ${form.Imagen === img ? "selected" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, Imagen: img }))}
                >
                  <img src={`/cartas/${img}`} alt={img} />
                </button>
              ))}
            </div>
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label">Habilidades</label>
            <textarea
              className="form-control"
              rows="2"
              name="Habilidades"
              value={form.Habilidades}
              onChange={handleChange}
              placeholder="Ej. Robo de vida"
              disabled={!isCreature}
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label">Uso</label>
            <textarea
              className="form-control"
              rows="2"
              name="Uso"
              value={form.Uso}
              onChange={handleChange}
              placeholder="Ej. Reduce coste de la siguiente carta"
              disabled={!isResource}
            />
          </div>

          <div className="col-12">
            <label className="form-label">Efecto</label>
            <textarea
              className="form-control"
              rows="3"
              name="Efecto"
              value={form.Efecto}
              onChange={handleChange}
              placeholder="Ej. Inflige daño adicional"
              disabled={!isSpell}
            />
          </div>

          <div className="col-12">
            <label className="form-label">Buff</label>
            <textarea
              className="form-control"
              rows="2"
              name="Buff"
              value={form.Buff}
              onChange={handleChange}
              placeholder="Ej. +2 ATK a aliados"
              disabled={!isEquipment}
            />
          </div>

          <div className="col-12 card-preview-row">
            <div className="card-preview rounded-4">
              <img src={`/cartas/${form.Imagen}`} alt={form.nombre || "Preview"} />
              <div className="card-preview-meta">
                <strong>{form.nombre || "Selecciona una carta"}</strong>
                <small>{form.saga}</small>
              </div>
            </div>
          </div>

          {error && (
            <div className="col-12 alert alert-danger">{error}</div>
          )}
          {status && (
            <div className="col-12 alert alert-success">{status}</div>
          )}

          <div className="col-12 d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/")}>Cancelar</button>
            <button type="submit" className="btn btn-gold" disabled={sending || !form.nombre.trim()}>
              {sending ? "Guardando..." : "Crear carta"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
