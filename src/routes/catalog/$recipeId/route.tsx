import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/catalog/$recipeId")({
  component: Outlet,
});
