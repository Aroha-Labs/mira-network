import { useEffect, useState } from "react";
import { Button } from "src/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "src/components/popover";
import useApiTokens from "src/hooks/useApiTokens";
import Card from "../card";

const AddApiKey = () => {
  const { addApiKey, data } = useApiTokens();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState<"success" | "error" | "">("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const description = (e.target as HTMLFormElement).description.value;
    await addApiKey.mutateAsync(description);
    setIsModalOpen(false);
  };

  useEffect(() => {
    if (addApiKey.isSuccess) {
      setDescription("success");
      setTimeout(() => setDescription(""), 2000);
    }
    if (addApiKey.isError) {
      setDescription("error");
      setTimeout(() => setDescription(""), 2000);
    }
  }, [addApiKey.isSuccess, addApiKey.isError]);

  return (
    <Popover open={isModalOpen} onOpenChange={setIsModalOpen}>
      <PopoverTrigger asChild>
        <Button onClick={() => setIsModalOpen(true)}>Add API Key</Button>
      </PopoverTrigger>
      <PopoverContent className="min-w-80 p-0">
        <Card className="p-[32px]">
          <div className="flex items-center justify-between pb-[12px]">
            <p className="text-md leading-[22px] tracking-[-0.013em] p-0 uppercase">
              &lt; Create new key
            </p>
            <div className="flex-grow border-t w-full border-dashed border-[#9CB9AE] mx-1 flex-1 h-[2px]" />
          </div>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-[#9C9B9B]"
            >
              name
            </label>
            <input
              id="description"
              type="text"
              placeholder={`secret-key-${(data?.length ?? 0) + 1}`}
              className="mt-1 block w-full px-3 py-2 border border-[#D7E2DE] shadow-sm focus:outline-none focus:border-[#308F6A] focus:border-blue-500 sm:text-sm"
            />
            {description === "error" && (
              <div className="text-red-600 mb-4 font-light text-sm mt-2">
                {addApiKey?.error?.message}
              </div>
            )}

            {description === "success" && (
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
