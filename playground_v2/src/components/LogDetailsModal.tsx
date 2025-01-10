import Modal from "src/components/Modal";

interface ApiLog {
  user_id: string;
  payload: string;
  prompt_tokens: number;
  total_tokens: number;
  model: string;
  id: number;
  response: string;
  completion_tokens: number;
  total_response_time: number;
  created_at: string;
}

interface LogDetailsModalProps {
  log: ApiLog;
  activeTab: "messages" | "raw";
  onClose: () => void;
  onTabChange: (tab: "messages" | "raw") => void;
}

const LogDetailsModal: React.FC<LogDetailsModalProps> = ({
  log,
  activeTab,
  onClose,
  onTabChange,
}) => (
  <Modal onClose={onClose} title="API Log Details">
    <div className="mb-4">
      <button
        className={`px-4 py-2 ${
          activeTab === "messages"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 text-gray-800"
        } rounded-l-md`}
        onClick={() => onTabChange("messages")}
      >
        Messages
      </button>
      <button
        className={`px-4 py-2 ${
          activeTab === "raw"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 text-gray-800"
        } rounded-r-md`}
        onClick={() => onTabChange("raw")}
      >
        Raw
      </button>
    </div>
    {activeTab === "messages" ? (
      <div className="space-y-4">
        {JSON.parse(log.payload).messages.map(
          (message: { role: string; content: string }, index: number) => (
            <div
              key={index}
              className={`p-2 rounded-md ${
                message.role === "user"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <strong>{message.role}:</strong> {message.content}
            </div>
          )
        )}
        <div className="p-2 rounded-md bg-green-100 text-green-800">
          <strong>Response:</strong> {log.response}
        </div>
      </div>
    ) : (
      <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded-md">
        {JSON.stringify(JSON.parse(log.payload), null, 2)}
      </pre>
    )}
  </Modal>
);

export default LogDetailsModal;
