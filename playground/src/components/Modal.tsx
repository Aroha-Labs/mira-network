import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

const Modal = ({
  title,
  onClose,
  children,
  footer,
  maxWidth = "sm:max-w-lg",
}: ModalProps) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          aria-hidden="true"
        />

        <div
          className={`relative inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:m-8 w-full sm:p-6 ${maxWidth}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3
                className="text-lg font-medium leading-6 text-gray-900"
                id="modal-title"
              >
                {title}
              </h3>
              <div className="mt-4">{children}</div>
            </div>
          </div>

          {footer && (
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">{footer}</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
