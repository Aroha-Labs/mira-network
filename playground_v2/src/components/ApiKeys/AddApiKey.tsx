import { useState } from "react";
import { Button } from "src/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "src/components/popover";
import useApiTokens from "src/hooks/useApiTokens";

const AddApiKey = () => {
  const { addApiKey } = useApiTokens();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const description = (e.target as HTMLFormElement).description.value;
    addApiKey.mutate(description);
  };

  return (
    <Popover open={isModalOpen} onOpenChange={setIsModalOpen}>
      <PopoverTrigger asChild>
        <Button onClick={() => setIsModalOpen(true)}>Add API Key</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <p className="text-md leading-[22px] tracking-[-0.013em] w-full text-center p-4">
          Create a new secret key
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Name
          </label>
          <input
            id="description"
            type="text"
            placeholder="secret-key-1"
            className="mt-1 block w-full px-3 py-2 border border-[#D7E2DE] shadow-sm focus:outline-none focus:border-[#308F6A] focus:border-blue-500 sm:text-sm"
          />
          {addApiKey.isError && (
            <div className="text-red-600 mb-4 font-light text-sm mt-2">
              Error adding API key: {addApiKey.error.message}
            </div>
          )}

          {addApiKey.isSuccess && (
            <div className="text-green-600 mb-4 font-light text-sm mt-2">
              API key created successfully
            </div>
          )}

          <div className="flex items-center gap-2 mt-4 w-full">
            <Button
              variant="secondary"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setIsModalOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full"
              loading={addApiKey.isPending}
            >
              Create Key
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};

export default AddApiKey;
