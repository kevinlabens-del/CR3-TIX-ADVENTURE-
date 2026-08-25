import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AdventureGame from "../app/AdventureGame";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) throw new Error("Point de montage du jeu introuvable.");

createRoot(root).render(
  <StrictMode>
    <AdventureGame />
  </StrictMode>,
);
