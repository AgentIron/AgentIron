/* @refresh reload */
import { render } from "solid-js/web";

const root = document.getElementById("root") as HTMLElement;

if (window.location.pathname === "/snip") {
  import("./components/snip/SnipOverlay").then(({ SnipOverlay }) => {
    render(() => <SnipOverlay />, root);
  });
} else {
  import("./App").then(({ default: App }) => {
    render(() => <App />, root);
  });
}
