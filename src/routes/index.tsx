import { createFileRoute } from "@tanstack/react-router";
import { MapHomePage } from "#/pages/map-home/ui/map-home-page";

export const Route = createFileRoute("/")({
  component: MapHomePage,
});
