import { Link } from "@tanstack/react-router";
import { useGetFlows } from "../hooks/flows";
import "./sidebar.css";

const Sidebar = () => {
  const { data: flows, isLoading, error, refetch, isFetching } = useGetFlows();

  return (
    <div className="sidebar bg-gray-800 text-white w-64 min-h-screen fixed top-0 left-0 md:relative md:flex md:flex-col z-50">
      <div className="p-4">
        <div className="flex justify-between items-center mb-16">
          <Link href="/" className="text-xl py-3 flex-col text-left">
            <div className="font-bold">Playground</div>
            <div className="text-xs">Create new Flows</div>
          </Link>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
            title="Refresh flows"
          >
            <svg
              className={`w-5 h-5 ${isFetching ? "animate-spin" : ""}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="text-gray-400 text-sm px-4">Loading flows...</div>
        ) : error ? (
          <div className="text-red-400 text-sm px-4">Error loading flows</div>
        ) : (
          <ul>
            {flows?.map((flow) => (
              <li key={flow.id} className="mb-2">
                <Link
                  href={`/flows/${flow.id}`}
                  className="flex items-center px-4 py-2 rounded hover:bg-gray-700"
                >
                  {flow.name}
                </Link>
              </li>
            ))}
            {!flows?.length && (
              <div className="text-gray-400 text-sm px-4">No flows found</div>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
