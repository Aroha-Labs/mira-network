import { useRef } from "react";
import { TextArea } from "src/components/TextArea";
import { Button } from "src/components/button";

const TypeMessage = ({ onSubmit }: { onSubmit: (message: string) => void }) => {
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const message = formData.get("message") as string;
    if (message.trim() === "") return;
    onSubmit(message);
    formRef.current?.reset(); // Reset form after submission
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit(); // Programmatically submit the form
      target.style.height = "auto";
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex gap-2 w-[480px] justify-center items-start absolute p-0 bottom-0 right-0 border border-solid border-[#306E564F] bg-[#F1F7F5]"
    >
      <TextArea
        name="message"
        className="flex-1 p-[12px] mt-[5px]"
        placeholder="type your message"
        onKeyDown={handleKeyDown}
      />
      <Button
        type="submit"
        className="bg-[#308F6A] m-[12px] text-white w-[51px] h-[28px] text-[13px] font-medium leading-[15.6px] tracking-[-0.02em] text-left decoration-skip-ink-none"
      >
        send
      </Button>
    </form>
  );
};

export default TypeMessage;
