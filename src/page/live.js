/** @prose
 * # Live reload
 *
 * Only `prose .` sends this script, so a built page never asks for it. The server tells a page
 * when something it shows has changed ([server.ts](../server.ts)), and the page reloads, keeping
 * its scroll position.
 *
 * It listens only while the page is visible, and not while it's prerendered. The page says when
 * it was rendered, so on connecting it catches up on what changed while it was hidden.
 */
{
  const here = document.body.dataset.path;
  const since = document.body.dataset.rendered;
  // `page.js` reads this key after the reload and scrolls back.
  const key = "prose:scroll:" + location.pathname;
  let events = null;
  const connect = () => {
    if (events || document.hidden || document.prerendering) return;
    events = new EventSource("/.prose/events?path=" + encodeURIComponent(here) + "&since=" + since);
    events.onopen = () => document.body.classList.remove("offline");
    events.onerror = () => document.body.classList.add("offline");
    events.onmessage = () => {
      try {
        sessionStorage.setItem(key, String(scrollY));
      } catch {}
      location.reload();
    };
  };
  const disconnect = () => {
    events?.close();
    events = null;
  };
  document.addEventListener("visibilitychange", () => (document.hidden ? disconnect() : connect()));
  document.addEventListener("prerenderingchange", connect);
  addEventListener("pagehide", disconnect);
  addEventListener("pageshow", connect);
  connect();
}
