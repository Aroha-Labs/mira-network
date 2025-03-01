import Modal from "src/components/Modal";
import { ApiLog } from "src/hooks/useApiLogs";
import Card from "../../card";
import BodySection from "./BodySection";
import HeadersSection from "./HeadersSection";
import Table from "./Table";

interface LogDetailsModalProps {
  log: ApiLog;
  onClose: () => void;
}

const LogDetailsModal = ({ log, onClose }: LogDetailsModalProps) => {
  return (
    <Modal
      onClose={onClose}
      title=""
      showCloseIcon={false}
      className="bg-transparent"
    >
      <Card>
        <Table log={log} />

        <HeadersSection />

        <BodySection payload={log.payload} />
      </Card>
    </Modal>
  );
};

export default LogDetailsModal;
