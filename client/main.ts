/** @prose
 * # The `/__prose/` client
 *
 * A Svelte 5 SPA (runes mode) built by `client/vite.config.ts` and served by Devframe as static
 * assets. A left rail (project → folders → files → sections → chunks) and a main pane showing the
 * selected node: its prose, then its children as first-paragraph summaries, and at a chunk its
 * syntax-highlighted code (spec §6.1). Hash routing gives every node a stable URL. State and the
 * RPC connection live in `store.svelte.ts`; this file only mounts the app and starts the connection.
 */
import { mount } from "svelte";
import App from "./components/App.svelte";
import { start } from "./store.svelte.js";

mount(App, { target: document.getElementById("app")! });
void start();
