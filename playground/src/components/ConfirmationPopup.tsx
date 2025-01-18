import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface ConfirmationPopupProps {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const ConfirmationPopup = ({
  title,
  onConfirm,
  onCancel,
  triggerRef,
}: ConfirmationPopupProps) => {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!triggerRef?.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!triggerRef?.current) {
        setPosition(null);
        return;
      }

      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const shouldShowAbove = rect.bottom + 180 > viewportHeight;

      setPosition({
        top: shouldShowAbove ? rect.top - 80 : rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 220),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [triggerRef]);

  if (!position) return null;

  return createPortal(
    <div
      className="fixed z-50 bg-white border rounded-md shadow-lg p-2 min-w-[200px]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="flex items-center gap-2 text-red-600 mb-2">
        <ExclamationTriangleIcon className="h-5 w-5" />
        <span className="font-medium">{title}</span>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-2 py-1 text-sm bg-red-500 text-white hover:bg-red-600 rounded"
        >
          Delete
        </button>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmationPopup;
