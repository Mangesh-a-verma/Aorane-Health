import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initMarketing } from "@workspace/analytics";

initMarketing({
  appName: "landing",
  ga4MeasurementId: import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined,
  metaPixelId: import.meta.env.VITE_META_PIXEL_ID as string | undefined,
  clarityProjectId: import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined,
});

createRoot(document.getElementById("root")!).render(<App />);
