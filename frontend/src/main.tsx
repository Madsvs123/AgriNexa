import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { LocaleProvider } from "./i18n/LocaleProvider";
import { applyDetectedLanguage } from "./i18n/bootstrap";
import "./i18n";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

// Fire-and-forget: the detector has already picked a language synchronously
// from storage or the time zone, so the app renders immediately and only
// switches if the API disagrees on a genuine first visit.
void applyDetectedLanguage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Translation bundles load over HTTP; Suspense covers that first tick. */}
    <Suspense fallback={null}>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </LocaleProvider>
    </Suspense>
  </StrictMode>,
);
