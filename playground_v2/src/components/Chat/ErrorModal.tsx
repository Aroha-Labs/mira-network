import Link from "next/link";
import Card from "src/components/card";
import Modal from "src/components/Modal";

interface ErrorModalProps {
  setIsModalOpen: (open: boolean) => void;
}

const ErrorModal = ({ setIsModalOpen }: ErrorModalProps) => {
  return (
    <Modal
      onClose={() => setIsModalOpen(false)}
      title=""
      showCloseIcon={false}
      className="bg-transparent"
    >
      <Card className="mb-4">
        <div className="pl-[20px] pr-[20px] pt-[14px] pb-[32px]">
          <p>
            Seems you have insufficient credits. To get access and free credits,
            please join our Discord server and send us a message there.
          </p>
          <div className="mt-8 flex gap-[6px]">
            <Link
              href="https://discord.com/invite/mira-network"
              target="_blank"
              className="px-4 py-2 text-white bg-black"
            >
              Join Discord
            </Link>
          </div>
        </div>
      </Card>
    </Modal>
  );
};

export default ErrorModal;
