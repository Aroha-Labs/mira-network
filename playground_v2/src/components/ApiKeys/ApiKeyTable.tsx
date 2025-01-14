"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableRow } from "src/components/Table";
import { Button } from "src/components/button";
import Card from "src/components/card";
import useApiTokens, { ApiKey } from "src/hooks/useApiTokens";
import AddApiKey from "./AddApiKey";
import DeleteApiKey from "./DeleteApiKey";

const getTokenDisplay = (token: string) => {
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
};

const ApiKeyTable = () => {
  const { data, isLoading, error } = useApiTokens();
  const [isCopied, setIsCopied] = useState("");

  const handleCopyToClipboard = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setIsCopied(token);
      setTimeout(() => setIsCopied(""), 2000); // Reset copy state after 2 seconds
    } catch (error) {
      console.error("Failed to copy headers: ", error);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-[720px] h-[400px] flex justify-center items-center">
        Loading...
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-[720px] h-[400px] flex justify-center items-center text-[#303030] opacity-40">
        *cricket noises*
      </Card>
    );
  }

  return (
    <Card className="min-w-full md:min-w-[720px] p-[32px]">
      <div className="flex gap-4 justify-between items-center sticky top-0 bg-white z-10">
        <p className="text-md leading-[22px] tracking-[-0.013em]">
          YOU HAVE {data?.length} API KEY{data?.length === 1 ? "" : "S"}
        </p>
        <AddApiKey />
      </div>
      <Table className="mt-10 mb-10">
        <TableBody>
          {data?.map((key: ApiKey) => {
            return (
              <TableRow key={key?.token} className="cursor-pointer">
                <TableCell className="text-[13px] pl-0">
                  {key.description}
                </TableCell>
                <TableCell className="opacity-40 min-w-[300px] text-[13px]">
                  {getTokenDisplay(key.token)}
                </TableCell>
                <TableCell
                  onClick={() => handleCopyToClipboard(key.token)}
                  className="cursor-pointer flex justify-end"
                >
                  <Button variant="link" className="p-0">
                    {isCopied === key.token ? "Copied!" : "Copy Key"}
                  </Button>
                </TableCell>
                <TableCell>
                  <DeleteApiKey token={key.token} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};

export default ApiKeyTable;
