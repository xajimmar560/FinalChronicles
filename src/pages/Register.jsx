import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./Auth.css";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("The server returned an invalid response (not JSON)");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      login(data);
      navigate("/");
    } catch (err) {
      setError(err.message);
      console.error("Registration error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>FINAL FANTASY</h1>
            <p>CHRONICLES TCG</p>
            <h2 className="auth-subtitle">Crear Cuenta</h2>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Recomendado: más de 3 caracteres"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Recomendado: más de 6 caracteres"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar Contraseña</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirma tu contraseña"
                disabled={loading}
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn-auth" disabled={loading || !username || !password || !confirmPassword}>
              {loading ? "Registrando..." : "Crear Cuenta"}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Tienes una cuenta?{" "}
              <a href="/login" className="link">
                Inicia sesión aquí
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
