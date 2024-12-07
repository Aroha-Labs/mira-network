import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "../../supabase";
import Playground from "../../Playground";
import Header from "../../components/Header";

interface Flow {
  id: number;
  name: string;
  icon: string;
  system_prompt: string;
}

const fetchFlow = async (flowid: string): Promise<Flow> => {
  const { data, error } = await supabase
    .from("flows")
    .select("*")
    .eq("id", flowid)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Flow not found");
  }

  return data;
};

export const Route = createFileRoute("/flows/$flowid")({
  loader: ({ params }) => fetchFlow(params.flowid),
  component: RouteComponent,
});

function RouteComponent() {
  const { flowid } = Route.useParams();
  const {
    data: flow,
    error,
    isLoading,
  } = useQuery<Flow>({
    queryKey: ["flow", flowid],
    queryFn: () => fetchFlow(flowid),
  });

  if (isLoading) {
    return (
      <>
        <Header
          left={
            <div className="animate-pulse flex items-center">
              <div className="h-6 w-6 bg-gray-200 rounded mr-2"></div>
              <div className="h-6 w-32 bg-gray-200 rounded"></div>
            </div>
          }
        />
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="text-red-600">Error: {(error as Error).message}</div>
    );
  }

  return (
    <>
      <Header left={`${flow?.icon} ${flow?.name}`} />
      <Playground flow={flow} />
    </>
  );
}
