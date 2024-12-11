import { createFileRoute } from "@tanstack/react-router";
import Playground from "../Playground";
import NetworkSelector from "../components/NetworkSelector";
import FlowSidebar from "../components/FlowSidebar";
import Layout from "../components/Layout";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <Layout headerLeft={<NetworkSelector />} sidebar={<FlowSidebar />}>
      <Playground />
    </Layout>
  );
}
