import { XMarkIcon } from "@heroicons/react/24/outline";
import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "src/lib/utils";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const Modal = ({
  title,
  onClose,
  children,
  showCloseIcon = true,
  className,
}: ModalProps & { showCloseIcon?: boolean; className?: string }) => {
  return createPortal(
    <div className="fixed inset-0 bg-gray-300 bg-opacity-50 flex items-center justify-center z-50">
      <div className={cn("p-4 max-w-lg w-full relative", className)}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          {showCloseIcon && (
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={onClose}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
