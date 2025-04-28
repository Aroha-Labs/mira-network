import { useState } from "react";
import Modal from "src/components/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import api from "src/lib/axios";
import { trackEvent } from "src/lib/mira";

interface AddCreditsModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

const AddCreditsModal = ({ userId, userName, onClose }: AddCreditsModalProps) => {
  const [credits, setCredits] = useState(0);
  const queryClient = useQueryClient();

  const addCreditsMutation = useMutation({
    mutationFn: async (amount: number) => {
      await api.post("/admin/add-credit", {
        user_id: userId,
        amount,
        description: "Admin added credits",
      });
    },
    onSuccess: () => {
      toast.success("Credits added successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (error) => {
      console.error("Failed to add credits:", error);
      toast.error("Failed to add credits");
    },
  });

  const handleAddCredits = (e: React.FormEvent) => {
    e.preventDefault();

    trackEvent('admin_add_credits', {
      user_id: userId,
      amount: credits
    });

    addCreditsMutation.mutate(credits);
  };

  return (
    <Modal
      title={`Add Credits for ${userName}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={onClose}
            disabled={addCreditsMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAddCredits}
            disabled={addCreditsMutation.isPending}
          >
            {addCreditsMutation.isPending ? (
              <span className="flex items-center">
                <svg
                  className="w-4 h-4 mr-2 -ml-1 animate-spin"
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
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Adding...
              </span>
            ) : (
              "Add"
            )}
          </button>
        </div>
      }
    >
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">Credits</label>
        <input
          type="number"
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value))}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          disabled={addCreditsMutation.isPending}
        />
        {addCreditsMutation.isError && (
          <p className="mt-2 text-sm text-red-600">
            Failed to add credits. Please try again.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default AddCreditsModal;
