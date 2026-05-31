import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./lib/monacoSetup";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
