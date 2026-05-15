import { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./DeckBuilder.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const typeNameMap = {
  C: "Criatura",
  H: "Hechizo",
  E: "Equipamiento",
  R: "Recurso",
};

const initialCards = [];

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

function DeckBuilder() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [availableCards, setAvailableCards] = useState(initialCards);
  const [selectedDeck, setSelectedDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presetLoading, setPresetLoading] = useState(true);
  const [presetActionLoading, setPresetActionLoading] = useState(false);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sagaFilter, setSagaFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const loadPresets = async () => {
    if (!user?.uid) {
      setPresetLoading(false);
      return;
    }

    try {
      setPresetLoading(true);
      const response = await fetch(`${BASE_URL}/api/users/${user.uid}/deck-presets`);
      if (!response.ok) throw new Error("No se pudieron cargar los mazos predefinidos");
      const data = await response.json();
      setPresets(data);
    } catch (error) {
      console.error(error);
    } finally {
      setPresetLoading(false);
    }
  };

  useEffect(() => {
    const loadCards = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage(null);

      try {
        const [cardsRes, deckRes] = await Promise.all([
          fetch(`${BASE_URL}/api/cards`),
          fetch(`${BASE_URL}/api/users/${user.uid}/deck`),
        ]);
        if (!cardsRes.ok) throw new Error("No se pudieron cargar las cartas");
        if (!deckRes.ok) throw new Error("No se pudo cargar el mazo guardado");

        const cardsData = await cardsRes.json();
        const deckData = await deckRes.json();

        const normalizedCards = cardsData.map(formatCard);
        setAvailableCards(normalizedCards);

        const deckCards = deckData
          .map((entry) => {
            const card = normalizedCards.find((item) => item.id === entry.idcarta);
            return card ? { ...card } : null;
          })
          .filter(Boolean);

        setSelectedDeck(deckCards);
      } catch (error) {
        console.error(error);
        setErrorMessage(error.message || "Error al cargar el editor de mazos");
      } finally {
        setLoading(false);
      }
    };

    (async () => {
      await loadPresets();
      await loadCards();
    })();
  }, [user]);

  const cardCounts = useMemo(() => {
    return selectedDeck.reduce((counts, card) => {
      counts[card.id] = (counts[card.id] || 0) + 1;
      return counts;
    }, {});
  }, [selectedDeck]);

  const selectedCards = useMemo(() => {
    return Object.entries(cardCounts).map(([id, count]) => {
      const card = availableCards.find((item) => item.id === Number(id));
      return { ...card, count };
    });
  }, [cardCounts, availableCards]);

  const typeOptions = ["Todos", "Criatura", "Hechizo", "Recurso", "Equipamiento"];
  const sagaOptions = useMemo(() => {
    const unique = Array.from(new Set(availableCards.map((card) => card.saga).filter(Boolean)));
    return unique.sort();
  }, [availableCards]);

  const filteredCards = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return availableCards.filter((card) => {
      if (typeFilter && typeFilter !== "Todos" && card.tipo !== typeFilter) {
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
  }, [availableCards, searchTerm, sagaFilter, typeFilter]);

  const totalCartas = selectedDeck.length;

  const handleAddCard = (card) => {
    const currentCount = cardCounts[card.id] || 0;
    if (currentCount >= 2) return;
    setSelectedDeck((prev) => [...prev, card]);
  };

  const handleRemoveCard = (cardId) => {
    setSelectedDeck((prev) => {
      const index = prev.findIndex((card) => card.id === cardId);
      if (index === -1) return prev;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleClearDeck = () => {
    setSelectedDeck([]);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleSavePreset = async () => {
    if (!user?.uid) return;
    if (!presetName.trim()) {
      setErrorMessage("Ingresa un nombre para el mazo predefinido");
      return;
    }
    if (selectedDeck.length === 0) {
      setErrorMessage("Tu mazo debe tener al menos una carta para guardarlo como predefinido");
      return;
    }

    setPresetActionLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`${BASE_URL}/api/users/${user.uid}/deck-presets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          nombremazo: presetName.trim(),
          cardIds: selectedDeck.map((card) => card.id),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo guardar el mazo predefinido");
      }

      setPresetName("");
      setStatusMessage("Mazo predefinido guardado correctamente.");
      await loadPresets();
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Error al guardar el mazo predefinido");
    } finally {
      setPresetActionLoading(false);
    }
  };

  const handleLoadPreset = async (presetId) => {
    if (!user?.uid) return;
    setPresetActionLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`${BASE_URL}/api/users/${user.uid}/deck-presets/${presetId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "No se pudo cargar el mazo predefinido");
      }

      const deckData = await response.json();
      const presetCards = deckData
        .map((entry) => {
          const card = availableCards.find((item) => item.id === entry.idcarta);
          return card ? { ...card } : null;
        })
        .filter(Boolean);

      setSelectedDeck(presetCards);
      setStatusMessage("Mazo predefinido cargado correctamente.");
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Error al cargar el mazo predefinido");
    } finally {
      setPresetActionLoading(false);
    }
  };

  const handleSaveDeck = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`${BASE_URL}/api/users/${user.uid}/deck`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          cardIds: selectedDeck.map((card) => card.id),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo guardar el mazo");
      }

      setStatusMessage("Mazo guardado correctamente.");
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Error al guardar el mazo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="deck-page">
      <div className="deck-header container py-5">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-4 mb-4">
          <div>
            <p className="deck-label">CONSTRUCTOR DE MAZOS</p>
            <h1 className="deck-title">Crea tu mazo de cartas</h1>
            <p className="deck-subtitle">Selecciona cartas a la izquierda y arma tu mazo en la columna de la derecha. Máximo 2 copias por carta.</p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>
              <i className="fa-solid fa-arrow-left me-2"></i>Volver
            </button>
            <button className="btn btn-gold" onClick={handleClearDeck}>
              Limpiar mazo
            </button>
          </div>
        </div>

        <div className="deck-stats row gx-3 gy-3">
          <div className="col-6 col-md-3 deck-stat-card">
            <p className="stat-label">Cartas en el mazo</p>
            <p className="stat-value">{totalCartas}</p>
          </div>
          <div className="col-6 col-md-3 deck-stat-card">
            <p className="stat-label">Copias restantes</p>
            <p className="stat-value">{Math.max(0, 30 - totalCartas)}</p>
          </div>
          <div className="col-6 col-md-3 deck-stat-card">
            <p className="stat-label">Límite por carta</p>
            <p className="stat-value">2</p>
          </div>
          <div className="col-6 col-md-3 deck-stat-card">
            <p className="stat-label">Tipo de mazo</p>
            <p className="stat-value">Libre</p>
          </div>
        </div>
      </div>

      <div className="deck-content container pb-5">
        <div className="row gx-4 gy-4">
          <div className="col-lg-7">
            <div className="deck-panel p-4 rounded-4 shadow-sm">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <h2 className="deck-panel-title">Cartas disponibles</h2>
                  <p className="deck-panel-subtitle">Haz clic en una carta para agregarla al mazo.</p>
                </div>
                <span className="badge bg-secondary">{availableCards.length} cartas</span>
              </div>

              {loading ? (
                <div className="text-center py-5">Cargando cartas...</div>
              ) : errorMessage ? (
                <div className="alert alert-danger">{errorMessage}</div>
              ) : (
                <>
                  <div className="row g-3 mb-3 collection-filter-row">
                    <div className="col-12 col-md-4">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar cartas"
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
                        {typeOptions.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {filteredCards.length === 0 ? (
                    <div className="empty-prompt">No hay cartas que coincidan con los filtros.</div>
                  ) : (
                    <div className="card-grid row g-3">
                      {filteredCards.map((card) => {
                        const count = cardCounts[card.id] || 0;
                        return (
                          <div key={card.id} className="col-12 col-md-6">
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
                                  <button
                                    className="btn btn-gold btn-sm"
                                    onClick={() => handleAddCard(card)}
                                    disabled={count >= 2}
                                  >
                                    {count >= 2 ? "Máximo" : "Añadir"}
                                  </button>
                                </div>
                                {count > 0 && <div className="selected-count">Añadidas: {count}</div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="col-lg-5">
            <div className="deck-panel p-4 rounded-4 shadow-sm deck-sidebar">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <h2 className="deck-panel-title">Mazo actual</h2>
                  <p className="deck-panel-subtitle">Arrastra el estilo de Hearthstone: selecciona cartas y constrúyelo aquí.</p>
                </div>
                <span className="badge bg-gold">{selectedCards.length} tipos</span>
              </div>

              <div className="preset-panel mb-4 p-3 rounded-4 bg-dark border border-secondary">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div>
                    <h5 className="mb-1">Mazos predefinidos</h5>
                    <p className="text-muted small mb-0">Guarda y carga mazos listos para jugar.</p>
                  </div>
                </div>
                <div className="mb-3 d-flex gap-2 flex-column flex-sm-row">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nombre del mazo predefinido"
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                  />
                  <button
                    className="btn btn-gold flex-shrink-0"
                    onClick={handleSavePreset}
                    disabled={presetActionLoading}
                  >
                    {presetActionLoading ? "Guardando..." : "Guardar preset"}
                  </button>
                </div>
                {presetLoading ? (
                  <div className="text-center text-muted">Cargando mazos...</div>
                ) : presets.length === 0 ? (
                  <div className="text-muted">No hay mazos predefinidos guardados.</div>
                ) : (
                  <div className="preset-list">
                    {presets.map((preset) => (
                      <div key={preset.idmazo} className="preset-item d-flex align-items-center justify-content-between mb-2 p-2 rounded-3 bg-secondary bg-opacity-10">
                        <div>
                          <strong>{preset.nombremazo}</strong>
                          <div className="text-muted small">{preset.cartas} cartas</div>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleLoadPreset(preset.idmazo)}
                          disabled={presetActionLoading}
                        >
                          Cargar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="deck-list">
                {selectedCards.length === 0 ? (
                  <div className="empty-prompt">No hay cartas seleccionadas aún.</div>
                ) : (
                  selectedCards.map((card) => (
                    <div key={card.id} className="deck-item d-flex align-items-center justify-content-between">
                      <div>
                        <h5 className="deck-item-title">{card.nombre}</h5>
                        <p className="deck-item-meta">{card.tipo} • Copias: {card.count}</p>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => handleRemoveCard(card.id)}>
                        Quitar
                      </button>
                    </div>
                  ))
                )}
              </div>

              {statusMessage && <div className="alert alert-success mt-3">{statusMessage}</div>}
              {errorMessage && <div className="alert alert-danger mt-3">{errorMessage}</div>}

              <div className="deck-footer mt-4">
                <button className="btn btn-gold w-100" disabled={selectedDeck.length === 0 || saving} onClick={handleSaveDeck}>
                  {saving ? "Guardando..." : `Guardar mazo (${selectedDeck.length} cartas)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default DeckBuilder;
