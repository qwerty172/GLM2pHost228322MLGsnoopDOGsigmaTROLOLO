import { createRoot } from "react-dom/client";
import {
  setAuthTokenGetter,
  setAdminSecretGetter,
  setHostTokenGetter,
  setUserTokensGetter,
} from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { initSentry } from "./lib/sentry";

void initSentry();

// Security: strip wallet/host tokens from API request URLs and send them in
// the X-User-Token header instead (keeps them out of history & server logs).
setUserTokensGetter(() => [
  localStorage.getItem("streamline.hostToken"),
  localStorage.getItem("streamline.playerWalletToken"),
]);

const getHostToken = () => localStorage.getItem("streamline.hostToken");

// Host /me routes authenticate via Authorization Bearer (preferred over path tokens).
setAuthTokenGetter(getHostToken);
// Admin routes require X-Host-Token explicitly (not only Bearer).
setHostTokenGetter(getHostToken);
setAdminSecretGetter(() => {
  try {
    return sessionStorage.getItem("streamline.adminSecret") ?? "";
  } catch {
    return "";
  }
});

createRoot(document.getElementById("root")!).render(<App />);
