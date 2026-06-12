// Icon Kit
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";

// SW registration guard: skip when embedded in an iframe (e.g. Lovable preview)
const isEmbedded = window.self !== window.top;

if (isEmbedded) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(<App />);
