import { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./DeckBuilder.css";
import "./Collection.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const typeNameMap = {
  C: "Criatura",
  H: "Hechizo",
  E: "Equipamiento",
  R: "Recurso",
};

function formatCard(card) {
  const tipo = typeNameMap[card.Tipo] || card.Tipo || "Desconocido";
  const descripcion =
    tipo === "Criatura"
      ? card.Habilidades || card.descripcion || ""
      : tipo === "Hechizo"
      ? card.Efecto || card.descripcion || ""
      : tipo === "Recurso"
      ? card.Uso || card.descripcion || ""
      : tipo === "Equipamiento"
      ? card.Buff || card.descripcion || ""
      : card.descripcion || "";

  return {
    id: card.idcarta || card.id,
    nombre: card.nombre,
    saga: card.saga || "",
    costo: card.costeprimario ?? card.costo ?? 0,
    ataque: card.ATK ?? card.ataque ?? 0,
    salud: card.HP ?? card.salud ?? 0,
    tipo,
    descripcion,
    imagen: card.Imagen ? `/cartas/${card.Imagen}` : card.imagen || "/cartas/cloud.png",
  };
}

function Collection() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sagaFilter, setSagaFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    const loadCollection = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${BASE_URL}/api/users/${user.uid}/collection`);
        if (!response.ok) {
          throw new Error("No se pudo cargar la colección");
        }
        const data = await response.json();
        setCollection(data.map(formatCard));
      } catch (err) {
        console.error(err);
        setError(err.message || "Error al cargar la colección");
      } finally {
        setLoading(false);
      }
    };

    loadCollection();
  }, [user]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, sagaFilter, typeFilter, collection.length]);

  const sagaOptions = useMemo(() => {
    const unique = Array.from(new Set(collection.map((card) => card.saga).filter(Boolean)));
    return unique.sort();
  }, [collection]);

  const filteredCards = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return collection.filter((card) => {
      if (typeFilter && card.tipo !== typeFilter) {
        return false;
      }

      if (sagaFilter && !card.saga.toLowerCase().includes(sagaFilter.toLowerCase())) {
        return false;
      }

      if (normalizedSearch) {
        const haystack = `${card.nombre} ${card.descripcion} ${card.saga}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      }

      return true;
    });
  }, [collection, searchTerm, sagaFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const currentCards = filteredCards.slice((page - 1) * pageSize, page * pageSize);

  return (
    <main className="collection-page">
      <div className="container-fluid py-5">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-4 mb-4">
          <div>
            <p className="deck-label">COLECCIÓN</p>
            <h1 className="deck-title">Tus cartas recolectadas</h1>
            <p className="deck-subtitle">Filtra por saga, tipo o busca por nombre para encontrar tus cartas rápidamente.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            <i className="fa-solid fa-arrow-left me-2"></i>Volver
          </button>
        </div>

        <div className="deck-panel p-4 rounded-4 shadow-sm">
          <div className="d-flex flex-column flex-lg-row gap-3 align-items-start align-items-lg-center justify-content-between mb-3">
            <div>
              <h2 className="deck-panel-title">Colección completa</h2>
              <p className="deck-panel-subtitle">Consulta las cartas que posees y explora tus mejores combinaciones.</p>
            </div>
            <span className="badge bg-secondary">{filteredCards.length} cartas</span>
          </div>

          <div className="row g-3 mb-4 collection-filter-row">
            <div className="col-12 col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre, saga o texto"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="col-6 col-md-4">
              <select className="form-select" value={sagaFilter} onChange={(event) => setSagaFilter(event.target.value)}>
                <option value="">Todas las sagas</option>
                {sagaOptions.map((saga) => (
                  <option key={saga} value={saga}>{saga}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-4">
              <select className="form-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">Todos los tipos</option>
                <option value="Criatura">Criatura</option>
                <option value="Hechizo">Hechizo</option>
                <option value="Recurso">Recurso</option>
                <option value="Equipamiento">Equipamiento</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">Cargando colección...</div>
          ) : error ? (
            <div className="alert alert-danger">{error}</div>
          ) : filteredCards.length === 0 ? (
            <div className="empty-prompt">No se encontraron cartas con esos criterios.</div>
          ) : (
            <>
              <div className="card-grid row g-3">
                {currentCards.map((card) => (
                  <div key={card.id} className="col-12 col-md-6 col-xl-4">
                    <div className="card deck-card h-100">
                      <div className="card-body p-3">
                        <div className="card-top d-flex align-items-center justify-content-between mb-3">
                          <span className="card-cost">{card.costo}</span>
                          <span className="card-type">{card.tipo}</span>
                        </div>
                        <h5 className="card-title">{card.nombre}</h5>
                        {card.imagen && (
                          <div className="card-image-wrapper mb-3">
                            <img src={card.imagen} alt={card.nombre} className="card-image" />
                          </div>
                        )}
                        <p className="card-text">{card.descripcion}</p>
                        <div className="d-flex justify-content-between align-items-center mt-3">
                          <div className="card-stats">
                            <span className="stat-pill">ATK {card.ataque}</span>
                            <span className="stat-pill">HP {card.salud}</span>
                          </div>
                          <span className="badge bg-gold">{card.saga}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="d-flex flex-wrap justify-content-center align-items-center gap-2 mt-4">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </button>
                  <span className="text-white">Página {page} de {totalPages}</span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default Collection;
