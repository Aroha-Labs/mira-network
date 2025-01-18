import { useState } from "react";
import { Button } from "src/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "src/components/popover";
import useApiTokens from "src/hooks/useApiTokens";

const DeleteApiKey = ({
  token,
  onModalOpenChange,
}: {
  token: string;
  onModalOpenChange: (open: boolean) => void;
}) => {
  const { deleteMutation } = useApiTokens();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDelete = () => {
    if (token) {
      deleteMutation.mutate(token);
    }
    handleOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    onModalOpenChange(open);
  };

  return (
    <Popover open={isModalOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="link"
          className="p-0"
          onClick={() => handleOpenChange(true)}
        >
          Delete
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <p className="text-md leading-[22px] tracking-[-0.013em] w-full text-center p-4">
          Confirm Delete?
        </p>

        <div className="flex justify-center gap-4">
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
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
