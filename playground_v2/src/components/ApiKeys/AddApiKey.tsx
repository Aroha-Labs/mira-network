import { useState } from "react";
import { Button } from "src/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "src/components/popover";
import useApiTokens from "src/hooks/useApiTokens";
import Card from "../card";

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
      <PopoverContent className="min-w-80 p-0">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-md leading-[22px] tracking-[-0.013em] pl-0 pr-4 pt-4 pb-4">
              &lt; Create new key
            </p>
            <div className="flex-grow border-t w-full border-dashed border-[#9CB9AE] mx-1 flex-1 h-[2px]" />
          </div>

          <form onSubmit={handleSubmit} className="py-4">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-[#9C9B9B]"
            >
              name
            </label>
            <input
              id="description"
              type="text"
              placeholder="secret-key-1"
              className="mt-1 block w-full px-3 py-2 border border-[#D7E2DE] shadow-sm focus:outline-none focus:border-[#308F6A] focus:border-blue-500 sm:text-sm"
            />
            {addApiKey?.isError && (
              <div className="text-red-600 mb-4 font-light text-sm mt-2">
                {addApiKey?.error?.message}
              </div>
            )}

            {addApiKey.isSuccess && (
              <div className="text-green-600 mb-4 font-light text-sm mt-2">
                API key created successfully
              </div>
            )}

            <div className="flex items-center gap-2 mt-4 w-full">
              <Button type="submit" loading={addApiKey.isPending}>
                Create Key
              </Button>
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
            </div>
          </form>
        </Card>
      </PopoverContent>
    </Popover>
  );
};

export default AddApiKey;
