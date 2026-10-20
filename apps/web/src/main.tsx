import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
const queries = new QueryClient();
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queries}>
      <main>
        <h1>Relay</h1>
        <p>Customer onboarding</p>
      </main>
    </QueryClientProvider>
  </StrictMode>,
);
