import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Playground from "../../Playground";
import Header from "../../components/Header";
import { useGetFlow, useDeleteFlow } from "../../hooks/flows";

export const Route = createFileRoute("/flows/$flowid")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { flowid } = Route.useParams();
  const { data: flow, error, isLoading } = useGetFlow(flowid);
  const deleteFlowMutation = useDeleteFlow();

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
      <>
        <Header left="Error" />
        <div className="p-4 text-red-600">
          Error: {(error as Error).message}
        </div>
      </>
    );
  }

  if (!flow) {
    return (
      <>
        <Header left="Flow not found" />
        <div className="p-4 text-gray-400">
          The requested flow was not found
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        left={
          <div className="flex items-center gap-2 text-white">
            <span>{flow.name}</span>
            <button
              onClick={async () => {
                if (
                  window.confirm("Are you sure you want to delete this flow?")
                ) {
                  await deleteFlowMutation.mutateAsync(flowid);
                  navigate({ to: "/" });
                }
              }}
              className="p-1 hover:text-red-600 transition-colors"
              title="Delete flow"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        }
      />
      <Playground flow={flow} />
    </>
  );
}
