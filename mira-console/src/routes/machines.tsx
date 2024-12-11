import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import { useGetMachines } from "../hooks/machine";
import "./machines.scss";

// Error message component
const ErrorMessage = ({ error }: { error: Error }) => (
  <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded relative">
    <span className="block sm:inline">
      {error.message || "An unexpected error occurred"}
    </span>
  </div>
);

export const Route = createFileRoute("/machines")({
  component: RouteComponent,
});

function RouteComponent() {
  const {
    data: machines,
    isLoading,
    error,
    isRefetching,
  } = useGetMachines({
    refetchInterval: 3000,
  });

  return (
    <Layout headerLeft="Machines">
      <div className="p-4 sm:container sm:mx-auto" style={{ maxWidth: 800 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-200">Machine List</h1>
            <p className="text-slate-400 mb-4">
              Overview of all registered machines and their statuses.
            </p>
          </div>
          {isRefetching && (
            <svg
              className="animate-spin h-5 w-5 text-slate-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
        </div>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse h-24 bg-slate-700 rounded-lg"
              />
            ))}
          </div>
        ) : error ? (
          <ErrorMessage error={error as Error} />
        ) : (
          <div className="grid gap-4">
            {machines?.map((machine) => (
              <div
                key={machine.machine_uid}
                className={`p-4 rounded-lg border ${
                  machine.status === "online"
                    ? "bg-slate-700 border-slate-600"
                    : "bg-slate-800 border-slate-700 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-slate-200">
                      {machine.machine_uid}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {machine.network_ip}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <span
                      className={`inline-block rounded-full mr-2 ${
                        machine.status === "online"
                          ? "w-3 h-3 bg-green-500 animate-blink"
                          : "w-2 h-2 bg-red-500"
                      }`}
                    />
                    <span className="text-sm text-slate-300">
                      {machine.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
