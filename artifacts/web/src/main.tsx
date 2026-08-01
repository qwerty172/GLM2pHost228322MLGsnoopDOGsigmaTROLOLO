import { createRoot } from "react-dom/client";
import {
  setAuthTokenGetter,
  setAdminSecretGetter,
  setUserTokensGetter,
} from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { initSentry } from "./lib/sentry";

const ADMIN_SECRET_KEY = "streamline.adminSecret";

void initSentry();

// Security: strip wallet/host tokens from API request URLs and send them in
// the X-User-Token header instead (keeps them out of history & server logs).
setUserTokensGetter(() => [
  localStorage.getItem("streamline.hostToken"),
  localStorage.getItem("streamline.playerWalletToken"),
]);

// Host /me routes authenticate via Authorization Bearer (preferred over path tokens).
setAuthTokenGetter(() => localStorage.getItem("streamline.hostToken"));

// Admin moderation routes require X-Admin-Secret (stored per tab in sessionStorage).
setAdminSecretGetter(() => {
  try {
    return sessionStorage.getItem(ADMIN_SECRET_KEY);
  } catch {
    return null;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
