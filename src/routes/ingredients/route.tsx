import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ingredients")({
  component: Outlet,
});
