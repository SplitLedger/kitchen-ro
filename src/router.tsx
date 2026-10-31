import { createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

// A reload of the current page still renders again, and that render jumps to the
// top unless this flag is cleared. Page changes leave it set, so those still scroll up.
router.subscribe("onBeforeLoad", ({ hrefChanged }) => {
  if (!hrefChanged) {
    router._scroll.n = false;
  }
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
