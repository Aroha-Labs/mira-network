import { useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "src/components/Select";
import useAllSupportedModels from "src/hooks/useAllSupportedModels";
import { cn } from "src/lib/utils";

const ModelDropdown = ({
  isModalOpen,
  setIsModalOpen,
  selectedModel,
  setSelectedModel,
}: {
  isModalOpen: boolean;
  setIsModalOpen: (isModalOpen: boolean) => void;
  selectedModel: string;
  setSelectedModel: (selectedModel: string) => void;
}) => {
  const { supportedModelsData, isModelsLoading } = useAllSupportedModels();

  const supportedModelsOptions = useMemo(() => {
    if (!supportedModelsData) return [];
    return supportedModelsData.map((m) => {
      const s = m.split("/");
      return { value: m, label: s[s.length - 1] };
    });
  }, [supportedModelsData]);

  useEffect(() => {
    if (supportedModelsData) {
      setSelectedModel(supportedModelsData[0]);
    }
  }, [supportedModelsData]);

  if (isModelsLoading) {
    return null;
  }

  return (
    <Select
      value={selectedModel}
      open={isModalOpen}
      onOpenChange={setIsModalOpen}
      onValueChange={setSelectedModel}
    >
      <SelectTrigger className="w-fit border-none outline-none shadow-none p-0 m-0">
        <SelectValue placeholder={selectedModel} />
      </SelectTrigger>
      <SelectContent align="end">
        {supportedModelsOptions.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            className={cn(selectedModel === o.value && "opacity-100")}
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ModelDropdown;
