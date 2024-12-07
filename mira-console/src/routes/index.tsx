import { createFileRoute } from "@tanstack/react-router";
import Playground from "../Playground";
import Header from "../components/Header";
import NetworkSelector from "../components/NetworkSelector";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <Header left={<NetworkSelector />} />
      <Playground />
    </>
  );
}
