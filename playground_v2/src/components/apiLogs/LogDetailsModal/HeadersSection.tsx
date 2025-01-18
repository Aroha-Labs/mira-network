import { Copy } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "src/components/button";

const HeadersSection = () => {
  const headers = {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer YOUR_API_KEY",
      Accept: "application/json",
    },
  };

  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(headers, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset copy state after 2 seconds
    } catch (error) {
      console.error("Failed to copy headers: ", error);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-md leading-[22px] tracking-[-0.013em]">Header</p>
        <Button
          variant="link"
          tooltip={isCopied ? "Copied!" : "Copy Header"}
          className="text-md leading-[22px] tracking-[-0.013em] cursor-pointer opacity-40 p-0"
          onClick={handleCopy}
        >
          <Copy />
        </Button>
      </div>

      <pre className="whitespace-pre-wrap bg-[#F4F4F5] p-4 text-sm border border-solid border-[#E7E7E7]">
        {JSON.stringify(headers, null, 2)}
      </pre>
    </div>
  );
};

export default HeadersSection;
