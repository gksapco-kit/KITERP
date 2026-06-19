import.meta.env = {"BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": false, "VITE_API_URL": "http://127.0.0.1:8000/api/v1", "VITE_STOREFRONT_URL": "http://localhost:3002", "VITE_WATCH_POLLING": "1"};import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=cab320f1"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=cab320f1"; const React = __vite__cjsImport1_react.__esModule ? __vite__cjsImport1_react.default : __vite__cjsImport1_react;
import __vite__cjsImport2_reactDom_client from "/node_modules/.vite/deps/react-dom_client.js?v=cab320f1"; const ReactDOM = __vite__cjsImport2_reactDom_client.__esModule ? __vite__cjsImport2_reactDom_client.default : __vite__cjsImport2_reactDom_client;
import { QueryClientProvider } from "/node_modules/.vite/deps/@tanstack_react-query.js?v=cab320f1";
import { apiClient } from "/src/api/client.ts";
import { attachAutoRefreshInterceptor, createAppQueryClient } from "/src/lib/queryClient.ts";
import { RouterProvider } from "/node_modules/.vite/deps/react-router-dom.js?v=cab320f1";
import { Toaster } from "/node_modules/.vite/deps/sonner.js?v=cab320f1";
import { router } from "/src/routes/index.tsx";
import { ThemeSync } from "/src/components/ThemeSync.tsx";
import { RootErrorBoundary } from "/src/components/RootErrorBoundary.tsx";
import { useAuthStore } from "/src/stores/authStore.ts";
import { initGlobalEscapeHandler } from "/src/lib/escapeCloseRegistry.ts";
import { resolveApiBaseUrl } from "/src/lib/apiBase.ts";
import { DRAFT_BROWSER_PREVIEW_PATH } from "/src/lib/storefrontPreviewUrl.ts";
import "/src/styles/globals.css";
initGlobalEscapeHandler();
const queryClient = createAppQueryClient();
attachAutoRefreshInterceptor(apiClient);
function isDraftPreviewPath(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === DRAFT_BROWSER_PREVIEW_PATH || path.startsWith(`${DRAFT_BROWSER_PREVIEW_PATH}/`) || path === "/websites/browser-preview";
}
;
(() => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (import.meta.env.DEV) {
    const host = window.location.hostname;
    if (host === "localhost" || host === "[::1]") {
      const url = new URL(window.location.href);
      url.hostname = "127.0.0.1";
      window.location.replace(url.toString());
      return;
    }
  }
  if (isDraftPreviewPath(path)) return;
  if (path === "/auth/handoff") return;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const refresh = params.get("refresh");
  if (token) {
    useAuthStore.getState().setTokens({
      access_token: token,
      refresh_token: refresh || "",
      token_type: "bearer"
    });
    params.delete("token");
    params.delete("refresh");
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `${path}?${qs}` : path);
  }
})();
console.log("%c🏪 VENDOR-WEB (Port 3001)", "color: #10b981; font-size: 16px; font-weight: bold;");
console.log("Open http://localhost:3001 — if it fails on Windows Docker, run scripts\\fix-localhost-docker.ps1 as Admin.");
async function preflight() {
  if (isDraftPreviewPath(window.location.pathname)) return;
  const token = localStorage.getItem("access_token");
  if (!token) return;
  const API = resolveApiBaseUrl();
  const ac = new AbortController();
  const t = window.setTimeout(() => ac.abort(), 5e3);
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ac.signal
    });
    if (res.status === 401 || res.status === 403) {
      useAuthStore.getState().logout();
    }
  } catch {
  } finally {
    clearTimeout(t);
  }
}
void preflight().catch(() => {
});
ReactDOM.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxDEV(React.StrictMode, { children: /* @__PURE__ */ jsxDEV(RootErrorBoundary, { children: /* @__PURE__ */ jsxDEV(QueryClientProvider, { client: queryClient, children: [
    /* @__PURE__ */ jsxDEV(ThemeSync, {}, void 0, false, {
      fileName: "/app/src/main.tsx",
      lineNumber: 100,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV(RouterProvider, { router }, void 0, false, {
      fileName: "/app/src/main.tsx",
      lineNumber: 101,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV(Toaster, { position: "top-right", richColors: true, closeButton: true }, void 0, false, {
      fileName: "/app/src/main.tsx",
      lineNumber: 102,
      columnNumber: 9
    }, this)
  ] }, void 0, true, {
    fileName: "/app/src/main.tsx",
    lineNumber: 99,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/app/src/main.tsx",
    lineNumber: 98,
    columnNumber: 5
  }, this) }, void 0, false, {
    fileName: "/app/src/main.tsx",
    lineNumber: 97,
    columnNumber: 3
  }, this)
);

//# sourceMappingURL=data:application/json;base64,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UUFBUTtBQUFBLEVBQ04sVUFDRDtBQUNDQyxpQkFBYVYsQ0FBQztBQUFBLEVBQ2hCO0FBQ0Y7QUFHQSxLQUFLTixVQUFVLEVBQUVpQixNQUFNLE1BQU07QUFDM0IsQ0FDRDtBQUVEakUsU0FBU2tFLFdBQVdDLFNBQVNDLGVBQWUsTUFBTSxDQUFFLEVBQUVDO0FBQUFBLEVBQ3BELHVCQUFDLE1BQU0sWUFBTixFQUNDLGlDQUFDLHFCQUNDLGlDQUFDLHVCQUFvQixRQUFRdkQsYUFDM0I7QUFBQSwyQkFBQyxlQUFEO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FBVTtBQUFBLElBQ1YsdUJBQUMsa0JBQWUsVUFBaEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUErQjtBQUFBLElBQy9CLHVCQUFDLFdBQVEsVUFBUyxhQUFZLFlBQVUsTUFBQyxhQUFXLFFBQXBEO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FBb0Q7QUFBQSxPQUh0RDtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBSUEsS0FMRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBTUEsS0FQRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBUUE7QUFDRiIsIm5hbWVzIjpbIlJlYWN0IiwiUmVhY3RET00iLCJRdWVyeUNsaWVudFByb3ZpZGVyIiwiYXBpQ2xpZW50IiwiYXR0YWNoQXV0b1JlZnJlc2hJbnRlcmNlcHRvciIsImNyZWF0ZUFwcFF1ZXJ5Q2xpZW50IiwiUm91dGVyUHJvdmlkZXIiLCJUb2FzdGVyIiwicm91dGVyIiwiVGhlbWVTeW5jIiwiUm9vdEVycm9yQm91bmRhcnkiLCJ1c2VBdXRoU3RvcmUiLCJpbml0R2xvYmFsRXNjYXBlSGFuZGxlciIsInJlc29sdmVBcGlCYXNlVXJsIiwiRFJBRlRfQlJPV1NFUl9QUkVWSUVXX1BBVEgiLCJxdWVyeUNsaWVudCIsImlzRHJhZnRQcmV2aWV3UGF0aCIsInBhdGhuYW1lIiwicGF0aCIsInJlcGxhY2UiLCJzdGFydHNXaXRoIiwid2luZG93IiwibG9jYXRpb24iLCJpbXBvcnQiLCJlbnYiLCJERVYiLCJob3N0IiwiaG9zdG5hbWUiLCJ1cmwiLCJVUkwiLCJocmVmIiwidG9TdHJpbmciLCJwYXJhbXMiLCJVUkxTZWFyY2hQYXJhbXMiLCJzZWFyY2giLCJ0b2tlbiIsImdldCIsInJlZnJlc2giLCJnZXRTdGF0ZSIsInNldFRva2VucyIsImFjY2Vzc190b2tlbiIsInJlZnJlc2hfdG9rZW4iLCJ0b2tlbl90eXBlIiwiZGVsZXRlIiwicXMiLCJoaXN0b3J5IiwicmVwbGFjZVN0YXRlIiwiY29uc29sZSIsImxvZyIsInByZWZsaWdodCIsImxvY2FsU3RvcmFnZSIsImdldEl0ZW0iLCJBUEkiLCJhYyIsIkFib3J0Q29udHJvbGxlciIsInQiLCJzZXRUaW1lb3V0IiwiYWJvcnQiLCJyZXMiLCJmZXRjaCIsImhlYWRlcnMiLCJBdXRob3JpemF0aW9uIiwic2lnbmFsIiwic3RhdHVzIiwibG9nb3V0IiwiY2xlYXJUaW1lb3V0IiwiY2F0Y2giLCJjcmVhdGVSb290IiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsInJlbmRlciJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJtYWluLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgUmVhY3RET00gZnJvbSAncmVhY3QtZG9tL2NsaWVudCdcbmltcG9ydCB7IFF1ZXJ5Q2xpZW50UHJvdmlkZXIgfSBmcm9tICdAdGFuc3RhY2svcmVhY3QtcXVlcnknXG5pbXBvcnQgeyBhcGlDbGllbnQgfSBmcm9tICdAL2FwaS9jbGllbnQnXG5pbXBvcnQgeyBhdHRhY2hBdXRvUmVmcmVzaEludGVyY2VwdG9yLCBjcmVhdGVBcHBRdWVyeUNsaWVudCB9IGZyb20gJ0AvbGliL3F1ZXJ5Q2xpZW50J1xuaW1wb3J0IHsgUm91dGVyUHJvdmlkZXIgfSBmcm9tICdyZWFjdC1yb3V0ZXItZG9tJ1xuaW1wb3J0IHsgVG9hc3RlciB9IGZyb20gJ3Nvbm5lcidcblxuaW1wb3J0IHsgcm91dGVyIH0gZnJvbSAnLi9yb3V0ZXMnXG5pbXBvcnQgeyBUaGVtZVN5bmMgfSBmcm9tICcuL2NvbXBvbmVudHMvVGhlbWVTeW5jJ1xuaW1wb3J0IHsgUm9vdEVycm9yQm91bmRhcnkgfSBmcm9tICcuL2NvbXBvbmVudHMvUm9vdEVycm9yQm91bmRhcnknXG5pbXBvcnQgeyB1c2VBdXRoU3RvcmUgfSBmcm9tICcuL3N0b3Jlcy9hdXRoU3RvcmUnXG5pbXBvcnQgeyBpbml0R2xvYmFsRXNjYXBlSGFuZGxlciB9IGZyb20gJy4vbGliL2VzY2FwZUNsb3NlUmVnaXN0cnknXG5pbXBvcnQgeyByZXNvbHZlQXBpQmFzZVVybCB9IGZyb20gJy4vbGliL2FwaUJhc2UnXG5pbXBvcnQgeyBEUkFGVF9CUk9XU0VSX1BSRVZJRVdfUEFUSCB9IGZyb20gJy4vbGliL3N0b3JlZnJvbnRQcmV2aWV3VXJsJ1xuaW1wb3J0ICcuL3N0eWxlcy9nbG9iYWxzLmNzcydcblxuaW5pdEdsb2JhbEVzY2FwZUhhbmRsZXIoKVxuXG5jb25zdCBxdWVyeUNsaWVudCA9IGNyZWF0ZUFwcFF1ZXJ5Q2xpZW50KClcbmF0dGFjaEF1dG9SZWZyZXNoSW50ZXJjZXB0b3IoYXBpQ2xpZW50KVxuXG4vLyBIYW5kbGUgdG9rZW4gaGFuZG9mZiBmcm9tIGJ1c2luZXNzIGZyb250IHZlbmRvciBzaWdudXAgKD90b2tlbj0gYWNjZXNzIEpXVCBvbiBub24taGFuZG9mZiByb3V0ZXMpLlxuLy8gRG8gbm90IHRyZWF0IC9hdXRoL2hhbmRvZmY/dG9rZW49IGFzIHNpZ251cCDigJQgdGhhdCBxdWVyeSBwYXJhbSBpcyBhIHNob3J0LWxpdmVkIGhhbmRvZmYgSldULlxuLy8gRG8gbm90IHRyZWF0IC9wcmV2aWV3L2RyYWZ0P3Rva2VuPSBhcyBhdXRoIOKAlCB0aGF0IHF1ZXJ5IHBhcmFtIGlzIGEgYnVpbGRlciBzbmFwc2hvdCB0b2tlbi5cbmZ1bmN0aW9uIGlzRHJhZnRQcmV2aWV3UGF0aChwYXRobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IHBhdGggPSBwYXRobmFtZS5yZXBsYWNlKC9cXC8rJC8sICcnKSB8fCAnLydcbiAgcmV0dXJuIHBhdGggPT09IERSQUZUX0JST1dTRVJfUFJFVklFV19QQVRIXG4gICAgfHwgcGF0aC5zdGFydHNXaXRoKGAke0RSQUZUX0JST1dTRVJfUFJFVklFV19QQVRIfS9gKVxuICAgIHx8IHBhdGggPT09ICcvd2Vic2l0ZXMvYnJvd3Nlci1wcmV2aWV3J1xufVxuXG47KCgpID0+IHtcbiAgY29uc3QgcGF0aCA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5yZXBsYWNlKC9cXC8rJC8sICcnKSB8fCAnLydcbiAgLy8gSW4gZGV2LCBjYW5vbmljYWxpemUgbG9vcGJhY2sgc28gY3Jvc3MtdGFiIHByZXZpZXcgc3luYyAobG9jYWxTdG9yYWdlKSB3b3JrcyBvbiBXaW5kb3dzLlxuICBpZiAoaW1wb3J0Lm1ldGEuZW52LkRFVikge1xuICAgIGNvbnN0IGhvc3QgPSB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWVcbiAgICBpZiAoaG9zdCA9PT0gJ2xvY2FsaG9zdCcgfHwgaG9zdCA9PT0gJ1s6OjFdJykge1xuICAgICAgY29uc3QgdXJsID0gbmV3IFVSTCh3aW5kb3cubG9jYXRpb24uaHJlZilcbiAgICAgIHVybC5ob3N0bmFtZSA9ICcxMjcuMC4wLjEnXG4gICAgICB3aW5kb3cubG9jYXRpb24ucmVwbGFjZSh1cmwudG9TdHJpbmcoKSlcbiAgICAgIHJldHVyblxuICAgIH1cbiAgfVxuICAvLyBEcmFmdCBwcmV2aWV3IG11c3QgdXNlIHRoZSBzYW1lIGNhbm9uaWNhbCBsb29wYmFjayBob3N0IGFzIHRoZSBidWlsZGVyIChzZWUgc3RvcmVmcm9udFByZXZpZXdVcmwpLlxuICBpZiAoaXNEcmFmdFByZXZpZXdQYXRoKHBhdGgpKSByZXR1cm5cbiAgaWYgKHBhdGggPT09ICcvYXV0aC9oYW5kb2ZmJykgcmV0dXJuXG5cbiAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKVxuICBjb25zdCB0b2tlbiA9IHBhcmFtcy5nZXQoJ3Rva2VuJylcbiAgY29uc3QgcmVmcmVzaCA9IHBhcmFtcy5nZXQoJ3JlZnJlc2gnKVxuICBpZiAodG9rZW4pIHtcbiAgICB1c2VBdXRoU3RvcmUuZ2V0U3RhdGUoKS5zZXRUb2tlbnMoe1xuICAgICAgYWNjZXNzX3Rva2VuOiB0b2tlbixcbiAgICAgIHJlZnJlc2hfdG9rZW46IHJlZnJlc2ggfHwgJycsXG4gICAgICB0b2tlbl90eXBlOiAnYmVhcmVyJyxcbiAgICB9KVxuICAgIHBhcmFtcy5kZWxldGUoJ3Rva2VuJylcbiAgICBwYXJhbXMuZGVsZXRlKCdyZWZyZXNoJylcbiAgICBjb25zdCBxcyA9IHBhcmFtcy50b1N0cmluZygpXG4gICAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKHt9LCAnJywgcXMgPyBgJHtwYXRofT8ke3FzfWAgOiBwYXRoKVxuICB9XG59KSgpXG5cbmNvbnNvbGUubG9nKCclY/Cfj6ogVkVORE9SLVdFQiAoUG9ydCAzMDAxKScsICdjb2xvcjogIzEwYjk4MTsgZm9udC1zaXplOiAxNnB4OyBmb250LXdlaWdodDogYm9sZDsnKVxuY29uc29sZS5sb2coJ09wZW4gaHR0cDovL2xvY2FsaG9zdDozMDAxIOKAlCBpZiBpdCBmYWlscyBvbiBXaW5kb3dzIERvY2tlciwgcnVuIHNjcmlwdHNcXFxcZml4LWxvY2FsaG9zdC1kb2NrZXIucHMxIGFzIEFkbWluLicpXG5cbi8vIFByZWZsaWdodDogdmFsaWRhdGUgc3RvcmVkIHRva2VuIGluIHRoZSBiYWNrZ3JvdW5kIChjbGVhcnMgc3RhbGUgYXV0aCBpZiAvYXV0aC9tZSBmYWlscykuXG5hc3luYyBmdW5jdGlvbiBwcmVmbGlnaHQoKSB7XG4gIGlmIChpc0RyYWZ0UHJldmlld1BhdGgod2luZG93LmxvY2F0aW9uLnBhdGhuYW1lKSkgcmV0dXJuXG4gIGNvbnN0IHRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2FjY2Vzc190b2tlbicpXG4gIGlmICghdG9rZW4pIHJldHVyblxuICBjb25zdCBBUEkgPSByZXNvbHZlQXBpQmFzZVVybCgpXG4gIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG4gIGNvbnN0IHQgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiBhYy5hYm9ydCgpLCA1MDAwKVxuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke0FQSX0vYXV0aC9tZWAsIHtcbiAgICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAgfSxcbiAgICAgIHNpZ25hbDogYWMuc2lnbmFsLFxuICAgIH0pXG4gICAgaWYgKHJlcy5zdGF0dXMgPT09IDQwMSB8fCByZXMuc3RhdHVzID09PSA0MDMpIHtcbiAgICAgIHVzZUF1dGhTdG9yZS5nZXRTdGF0ZSgpLmxvZ291dCgpXG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICAvLyBOZXR3b3JrIGJsaXAg4oCUIGtlZXAgdG9rZW5zIChzaWdudXAgaGFuZG9mZiBmcm9tIC9jcmVhdGUtYnVzaW5lc3MgbXVzdCBub3QgYm91bmNlIHRvIGxvZ2luKVxuICB9IGZpbmFsbHkge1xuICAgIGNsZWFyVGltZW91dCh0KVxuICB9XG59XG5cbi8vIERvIG5vdCBjaGFpbiByZW5kZXIgYmVoaW5kIHByZWZsaWdodCDigJQgYSBzbG93IG9yIHN0dWNrIC9hcGkgcHJveHkgd291bGQgbGVhdmUgYSBibGFuayB0YWIuXG52b2lkIHByZWZsaWdodCgpLmNhdGNoKCgpID0+IHtcbiAgLyogYmVzdC1lZmZvcnQgc2Vzc2lvbiBoeWdpZW5lICovXG59KVxuXG5SZWFjdERPTS5jcmVhdGVSb290KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyb290JykhKS5yZW5kZXIoXG4gIDxSZWFjdC5TdHJpY3RNb2RlPlxuICAgIDxSb290RXJyb3JCb3VuZGFyeT5cbiAgICAgIDxRdWVyeUNsaWVudFByb3ZpZGVyIGNsaWVudD17cXVlcnlDbGllbnR9PlxuICAgICAgICA8VGhlbWVTeW5jIC8+XG4gICAgICAgIDxSb3V0ZXJQcm92aWRlciByb3V0ZXI9e3JvdXRlcn0gLz5cbiAgICAgICAgPFRvYXN0ZXIgcG9zaXRpb249XCJ0b3AtcmlnaHRcIiByaWNoQ29sb3JzIGNsb3NlQnV0dG9uIC8+XG4gICAgICA8L1F1ZXJ5Q2xpZW50UHJvdmlkZXI+XG4gICAgPC9Sb290RXJyb3JCb3VuZGFyeT5cbiAgPC9SZWFjdC5TdHJpY3RNb2RlPixcbilcbiJdLCJmaWxlIjoiL2FwcC9zcmMvbWFpbi50c3gifQ==