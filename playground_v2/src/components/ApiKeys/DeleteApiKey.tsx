import { useState } from "react";
import { Button } from "src/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "src/components/popover";
import useApiTokens from "src/hooks/useApiTokens";

const DeleteApiKey = ({ token }: { token: string }) => {
  const { deleteMutation } = useApiTokens();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDelete = () => {
    if (token) {
      deleteMutation.mutate(token);
    }
  };

  return (
    <Popover open={isModalOpen} onOpenChange={setIsModalOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="link"
          className="p-0"
          onClick={() => setIsModalOpen(true)}
        >
          Delete
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <p className="text-md leading-[22px] tracking-[-0.013em] w-full text-center p-4">
          Confirm Delete?
        </p>

        <div className="flex justify-center gap-4">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DeleteApiKey;
