import { useState } from "react";
import axios from "axios";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";
import Modal from "src/components/Modal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ProfileImage from "./ProfileImage";
import { PlusIcon } from "@heroicons/react/24/outline";

const USDollar = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

interface User {
  id: string;
  user_metadata: {
    name: string;
    email: string;
    avatar_url: string;
  };
}

const fetchUserCredits = async (userId: string, token: string) => {
  const response = await axios.get(
    `${API_BASE_URL}/admin/user-credits/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data.credits;
};

const UserCard = ({ user }: { user: User }) => {
  const { data: userSession } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [credits, setCredits] = useState(0);
  const queryClient = useQueryClient();

  const {
    data: userCredits,
    error: creditsError,
    isLoading: isCreditsLoading,
  } = useQuery({
    queryKey: ["userCredits", user.id],
    queryFn: () => fetchUserCredits(user.id, userSession?.access_token || ""),
    enabled: !!userSession?.access_token,
  });

  const addCreditsMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!userSession?.access_token) return;

      await axios.post(
        `${API_BASE_URL}/add-credit`,
        {
          user_id: user.id,
          amount,
          description: "Admin added credits",
        },
        {
          headers: {
            Authorization: `Bearer ${userSession.access_token}`,
          },
        }
      );
    },
    onSuccess: () => {
      alert("Credits added successfully");
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["userCredits", user.id] });
    },
    onError: (error) => {
      console.error("Failed to add credits:", error);
      alert("Failed to add credits");
    },
  });

  const handleAddCredits = (e: React.FormEvent) => {
    e.preventDefault();
    addCreditsMutation.mutate(credits);
  };

  return (
    <li className="p-4 bg-gray-100 rounded shadow-sm">
      <div className="flex items-center space-x-4">
        <ProfileImage
          src={user.user_metadata.avatar_url}
          alt={user.user_metadata.name}
          className="w-10 h-10 rounded-full"
        />
        <div>
          <p className="font-bold">{user.user_metadata.name}</p>
          <p className="text-gray-600">{user.user_metadata.email}</p>
          <div className="flex items-center space-x-2">
            <span className="text-gray-500 text-sm">{user.id}</span>
            <CopyToClipboardIcon text={user.id} />
          </div>
          <div className="mt-2 flex items-center space-x-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-500 text-white text-sm px-1 rounded hover:bg-blue-600 flex items-center space-x-1"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add Credits</span>
            </button>
            {isCreditsLoading ? (
              <span className="text-gray-500 text-sm">Loading credits...</span>
            ) : creditsError ? (
              <span className="text-red-500 text-sm">
                Error loading credits
              </span>
            ) : (
              <span className="text-gray-500 text-sm">
                Credits: {USDollar.format(userCredits)}
              </span>
            )}
          </div>
        </div>
      </div>
      {isModalOpen && (
        <Modal title="Add Credits" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleAddCredits} className="flex flex-col space-y-4">
            <input
              type="number"
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              className="border border-gray-300 p-2 rounded"
              placeholder="Credits"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
              disabled={addCreditsMutation.isPending}
            >
              {addCreditsMutation.isPending ? "Adding..." : "Add Credits"}
            </button>
          </form>
        </Modal>
      )}
    </li>
  );
};

export default UserCard;
