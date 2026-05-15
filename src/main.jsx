import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/lobster";
import "mdb-react-ui-kit/dist/css/mdb.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import React from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import DeckBuilder from "./pages/DeckBuilder.jsx";
import Collection from "./pages/Collection.jsx";
import CardAdmin from "./pages/CardAdmin.jsx";
import ErrorPage from "./pages/ErrorPage.jsx";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/",
    element: <ProtectedRoute><Home /></ProtectedRoute>,
    errorElement: <ErrorPage />,
  },
  {
    path: "/deck-builder",
    element: <ProtectedRoute><DeckBuilder /></ProtectedRoute>,
  },
  {
    path: "/collection",
    element: <ProtectedRoute><Collection /></ProtectedRoute>,
  },
  {
    path: "/admin/cards",
    element: <ProtectedRoute><CardAdmin /></ProtectedRoute>,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

createRoot(document.getElementById("app")).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
