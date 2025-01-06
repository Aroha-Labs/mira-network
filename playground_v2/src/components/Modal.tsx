import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const Modal = ({ title, onClose, children }: ModalProps) => {
  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg max-w-lg w-full relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
