import { ExclamationCircleIcon } from "@heroicons/react/24/outline";

interface ErrorMessageProps {
  message: string;
  retry?: () => void;
}

export default function ErrorMessage({ message, retry }: ErrorMessageProps) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
      <div className="flex items-center">
        <ExclamationCircleIcon className="h-5 w-5 text-red-400 mr-3" />
        <span className="text-red-700">{message}</span>
      </div>
      {retry && (
        <button
          onClick={retry}
          className="mt-3 text-sm text-red-600 hover:text-red-500 font-medium"
        >
          Try again
        </button>
      )}
    </div>
  );
}
