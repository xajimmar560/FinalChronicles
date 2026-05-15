import { useEffect, useState, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { AuthContext } from "../context/AuthContext";
import "./Home.css";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function Home() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [newFriendName, setNewFriendName] = useState("");
  const [requestError, setRequestError] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const actions = [
    { label: "Jugar", icon: "fa-play", primary: true },
    { label: "Editor de mazos", icon: "fa-swords", path: "/deck-builder" },
    { label: "Colección", icon: "fa-book", path: "/collection" },
    { label: "Abrir sobres", icon: "fa-scroll" },
    { label: "Ranked", icon: "fa-trophy" },
    { label: "Opciones", icon: "fa-gear" },
  ];

  function statusClass(status) {
    if (status.toLowerCase().includes("online")) return "status-online";
    if (status.toLowerCase().includes("game")) return "status-game";
    return "status-offline";
  }

  function mapFriendResponse(friend) {
    return {
      id: friend.uid || friend.id,
      name: friend.nombre_usuario || friend.name || "Amigo",
      level: friend.level || 1,
      status: friend.status || "Offline",
      available: typeof friend.available === "boolean" ? friend.available : false,
    };
  }

  useEffect(() => {
    async function loadProfileAndFriends() {
      try {
        const PROFILE_API = `/api/users/${user.uid}/profile`;
        const FRIENDS_API = `/api/users/${user.uid}/friends`;

        const [profileRes, friendsRes] = await Promise.all([
          fetch(PROFILE_API),
          fetch(FRIENDS_API),
        ]);

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfile(profileData);
        } else {
          setProfile(user);
        }

        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          if (Array.isArray(friendsData) && friendsData.length) {
            setFriends(friendsData.map(mapFriendResponse));
          }
        }
      } catch (error) {
        console.warn("Error cargando datos:", error);
        setProfile(user);
      } finally {
        setLoading(false);
      }
    }

    loadProfileAndFriends();
    reloadRequests();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("register", { userId: user.uid });
    });

    socket.on("friendRequestReceived", (request) => {
      setRequests((prev) => (prev.some((item) => item.id === request.id) ? prev : [request, ...prev]));
    });

    socket.on("friendListUpdated", async () => {
      const friendsRes = await fetch(`/api/users/${user.uid}/friends`);
      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        setFriends(friendsData.map(mapFriendResponse));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const reloadRequests = async () => {
    try {
      const response = await fetch(`/api/users/${user.uid}/requests`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (err) {
      console.warn("Error al cargar solicitudes:", err);
    }
  };

  const handleSendRequest = async (event) => {
    event.preventDefault();
    setRequestError("");
    if (!newFriendName.trim()) {
      setRequestError("Enter a username");
      return;
    }

    setRequestLoading(true);

    try {
      const response = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originId: user.uid, targetUsername: newFriendName.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        setRequestError(data.error || "Error sending request");
      } else {
        setNewFriendName("");
        await reloadRequests();
      }
    } catch (err) {
      setRequestError("Could not send request");
      console.error(err);
    } finally {
      setRequestLoading(false);
    }
  };

  const handleRespondRequest = async (requestId, action) => {
    try {
      const response = await fetch(`/api/friends/request/${requestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId: user.uid }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.warn("Error al responder solicitud:", data.error);
      } else {
        await reloadRequests();
        const friendsRes = await fetch(`/api/users/${user.uid}/friends`);
        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          setFriends(friendsData.map(mapFriendResponse));
        }
      }
    } catch (err) {
      console.error("Error al responder solicitud:", err);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      const response = await fetch(`/api/friends/${friendId}?userId=${user.uid}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        console.warn("Error eliminando amigo");
      } else {
        // Recargar lista de amigos
        const friendsRes = await fetch(`/api/users/${user.uid}/friends`);
        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          setFriends(friendsData.map(mapFriendResponse));
        }
      }
    } catch (err) {
      console.error("Error eliminando amigo:", err);
    }
  };

  const handleSwitchUser = () => {
    logout();
    navigate("/login");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const displayProfile = profile || user;

  return (
    <main className="home-page">
      <div className="home-hero container py-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <p style={{ color: "#f3d45f", margin: "0", fontSize: "0.9rem", letterSpacing: "0.05em" }}>
              Bienvenido, {user.nombre_usuario}!
            </p>
          </div>
          <div className="d-flex gap-2">
            {user.uid === 1 && (
              <button
                type="button"
                className="btn btn-gold"
                onClick={() => navigate("/admin/cards")}
                style={{ minWidth: "140px" }}
              >
                <i className="fa-solid fa-plus me-2"></i>
                Alta Carta
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSwitchUser}
              style={{ minWidth: "120px" }}
            >
              <i className="fa-solid fa-user me-2"></i>
              Cambiar Usuario
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLogout}
              style={{ minWidth: "120px" }}
            >
              <i className="fa-solid fa-sign-out-alt me-2"></i>
              Logout
            </button>
          </div>
        </div>

        <div className="row gx-4 gy-4 align-items-start">
          <section className="col-lg-6">
            <div className="hero-panel p-4 p-lg-5 rounded-4 shadow-sm">
              <div className="hero-title text-center text-lg-start mb-4">
                <p className="page-title mb-2">FINAL FANTASY</p>
                <h1 className="page-subtitle">CHRONICLES TCG</h1>
              </div>
              <div className="action-list row g-3">
                {actions.map((action) => (
                  <div key={action.label} className="col-12">
                    <button
                      type="button"
                      className={`btn action-btn w-100 text-start d-flex align-items-center justify-content-between ${action.primary ? "btn-gold btn-lg primary-action" : "btn-secondary"}`}
                      onClick={() => action.path && navigate(action.path)}
                    >
                      <span>
                        <i className={`fa-solid ${action.icon} me-3`}></i>
                        {action.label}
                      </span>
                      {action.primary && <i className="fa-solid fa-arrow-right"></i>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="col-lg-6">
            <div className="friends-panel p-4 p-lg-5 rounded-4 shadow-sm">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center mb-4">
                <div>
                  <h2 className="friends-title mb-1">Amigos conectados</h2>
                  <p className="friends-subtitle mb-0">Desafía a tus amigos a un duelo</p>
                </div>
              </div>

              <div className="request-panel mb-4 rounded-4 p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h3 className="friends-title mb-1" style={{ fontSize: "1rem" }}>Solicitudes de Amistad</h3>
                    <p className="friends-subtitle mb-0">Envía una solicitud</p>
                  </div>
                </div>
                <form className="d-flex gap-2 flex-column flex-md-row align-items-stretch" onSubmit={handleSendRequest}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Friend username"
                    value={newFriendName}
                    onChange={(e) => setNewFriendName(e.target.value)}
                    disabled={requestLoading}
                  />
                  <button type="submit" className="btn btn-gold" disabled={requestLoading}>
                    {requestLoading ? "Sending..." : "Send"}
                  </button>
                </form>
                {requestError && <div className="form-error mt-3">{requestError}</div>}

                {requests.length > 0 && (
                  <div className="mt-3">
                    <p className="friends-subtitle mb-2">Solicitudes pendientes</p>
                    {requests.map((request) => (
                      <div key={request.id} className="friend-row mb-2">
                        <div className="friend-info d-flex align-items-center gap-3">
                          <div className="friend-avatar">{request.originName.charAt(0)}</div>
                          <div>
                            <h3 className="friend-name mb-1">{request.originName}</h3>
                            <div className="friend-meta text-muted">
                              <span>Solicitud pendiente</span>
                            </div>
                          </div>
                        </div>
                        <div className="d-flex gap-2 flex-wrap">
                          <button type="button" className="btn btn-gold btn-sm" onClick={() => handleRespondRequest(request.id, "accept")}>Accept</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRespondRequest(request.id, "decline")}>Decline</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="friends-list">
                {loading ? (
                  <div className="loading-placeholder">Cargando amigos...</div>
                ) : friends.length > 0 ? (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className={`friend-row ${!friend.available ? "friend-unavailable" : ""}`}
                    >
                      <div className="friend-info d-flex align-items-center gap-3">
                        <div className="friend-avatar">{friend.name.charAt(0)}</div>
                        <div>
                          <h3 className="friend-name mb-1">{friend.name}</h3>
                          <div className="friend-meta text-muted">
                            <span>Lvl {friend.level}</span>
                            <span className="mx-2">•</span>
                            <span className={statusClass(friend.status)}>{friend.status}</span>
                          </div>
                        </div>
                      </div>
                      <div className="d-flex gap-2 flex-wrap">
                        <button
                          type="button"
                          className="btn invite-btn btn-gold"
                          disabled={!friend.available}
                        >
                          Invitar
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveFriend(friend.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="loading-placeholder">No tienes amigos aún</div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <div className="row mt-4">
          <div className="col-12">
            <div className="profile-summary p-4 rounded-4 shadow-sm">
              <div className="row text-center text-md-start align-items-center">
                <div className="col-sm-4 mb-4 mb-sm-0">
                  <p className="stat-value">{displayProfile.level || 1}</p>
                  <p className="stat-label">Nivel</p>
                </div>
                <div className="col-sm-4 mb-4 mb-sm-0">
                  <p className="stat-value">{displayProfile.cardsCount || 0}</p>
                  <p className="stat-label">Tarjetas</p>
                </div>
                <div className="col-sm-4">
                  <p className="stat-value">{typeof displayProfile.guiles === "number" ? displayProfile.guiles.toLocaleString() : "0"}</p>
                  <p className="stat-label">Guiles</p>
                </div>
              </div>
              <p className="footer-note mt-4 mb-0">Fan-made tribute • Inspired by Final Fantasy, Magic: The Gathering & Hearthstone</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Home;
