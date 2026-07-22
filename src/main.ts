import { resolveRedirectUrl, type Bang } from "./bang-redirect";
import "./global.css";

// Fire immediately (not on `window.load`) so the service worker has a chance
// to install even on a visit that's about to navigate away via a redirect.
// This never blocks the redirect below — it's best-effort for next time.
if ("serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => registerSW());
}

function noSearchDefaultPageRender() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
      <div class="content-container">
        <h1>Und*ck</h1>
        <p>DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Enables <a href="https://duckduckgo.com/bang.html" target="_blank">all of DuckDuckGo's bangs.</a></p>
        <div class="url-container"> 
          <input 
            type="text" 
            class="url-input"
            value="https://undxck.edlei.dev/?q=%s"
            readonly 
          />
          <button class="copy-button">
            <img src="/clipboard.svg" alt="Copy" />
          </button>
        </div>
      </div>
      <footer class="footer">
        <a href="https://t3.chat" target="_blank">t3.chat</a>
        •
        <a href="https://x.com/theo" target="_blank">theo</a>
        •
        <a href="https://github.com/t3dotgg/unduck" target="_blank">github</a>
      </footer>
    </div>
  `;

  const copyButton = app.querySelector<HTMLButtonElement>(".copy-button")!;
  const copyIcon = copyButton.querySelector("img")!;
  const urlInput = app.querySelector<HTMLInputElement>(".url-input")!;

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(urlInput.value);
    copyIcon.src = "/clipboard-check.svg";

    setTimeout(() => {
      copyIcon.src = "/clipboard.svg";
    }, 2000);
  });
}

async function getBangredirectUrl(): Promise<string | null> {
  const url = new URL(window.location.href);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    noSearchDefaultPageRender();
    return null;
  }

  // In production this whole file is a fallback: the Cloudflare Worker already
  // redirected before any HTML was sent. Only pay for the (large) bang list
  // when the query actually names one.
  const needsBangLookup = /!\S+/i.test(query);
  const bangs: Bang[] = needsBangLookup ? (await import("./bang")).bangs : [];
  const bangMap = new Map(bangs.map((b) => [b.t, b]));

  return resolveRedirectUrl(query, (t) => bangMap.get(t));
}

async function doRedirect() {
  const searchUrl = await getBangredirectUrl();
  if (!searchUrl) return;
  window.location.replace(searchUrl);
}

doRedirect();
