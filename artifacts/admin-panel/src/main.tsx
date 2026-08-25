import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply the saved theme before first paint so every page — including
// Login, which renders before Layout ever mounts — respects it instead
// of always defaulting to dark. No saved preference yet defaults to light.
try {
  document.documentElement.classList.toggle("dark", localStorage.getItem("aorane_theme") === "dark");
} catch { /* localStorage unavailable (private mode, etc.) — default light is fine */ }

createRoot(document.getElementById("root")!).render(<App />);
