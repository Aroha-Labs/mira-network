import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { JsonValue } from "src/types/json";

interface SettingValueProps {
  value: JsonValue;
  level?: number;
  showRaw?: boolean; // Add this prop
}

const ValueLabel = ({ type }: { type: string }) => (
  <span
    className={`
    text-xs px-1.5 py-0.5 rounded-md font-medium
    ${type === "string" && "bg-green-50 text-green-700"}
    ${type === "number" && "bg-blue-50 text-blue-700"}
    ${type === "boolean" && "bg-purple-50 text-purple-700"}
    ${type === "array" && "bg-amber-50 text-amber-700"}
    ${type === "object" && "bg-rose-50 text-rose-700"}
  `}
  >
    {type}
  </span>
);

const SettingValue = ({ value, level = 0, showRaw = false }: SettingValueProps) => {
  const [isExpanded, setIsExpanded] = useState(level < 1);
  const valueType = Array.isArray(value) ? "array" : typeof value;
  const isExpandable = valueType === "object" || valueType === "array";

  if (showRaw || (level === 0 && showRaw)) {
    return (
      <pre className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-x-auto font-mono text-sm text-gray-800">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (level === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <RenderValue
          value={value}
          valueType={valueType}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          isExpandable={isExpandable}
          level={level}
        />
      </div>
    );
  }

  return (
    <RenderValue
      value={value}
      valueType={valueType}
      isExpanded={isExpanded}
      setIsExpanded={setIsExpanded}
      isExpandable={isExpandable}
      level={level}
    />
  );
};

interface RenderValueProps {
  value: JsonValue;
  valueType: string;
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  isExpandable: boolean;
  level: number;
}

const RenderValue = ({
  value,
  valueType,
  isExpanded,
  setIsExpanded,
  isExpandable,
  level,
}: RenderValueProps) => {
  if (value === null) return <span className="text-gray-400 italic">null</span>;

  if (valueType === "string") {
    return (
      <div className="flex items-center gap-2">
        <ValueLabel type="string" />
        <span className="text-gray-800 break-all">&quot;{value as string}&quot;</span>
      </div>
    );
  }

  if (valueType === "number") {
    return (
      <div className="flex items-center gap-2">
        <ValueLabel type="number" />
        <span className="text-blue-600 font-mono">{value as number}</span>
      </div>
    );
  }

  if (valueType === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <ValueLabel type="boolean" />
        <span className={value ? "text-green-600" : "text-red-600"}>
          {(value as boolean).toString()}
        </span>
      </div>
    );
  }

  if (valueType === "array") {
    const arrayValue = value as JsonValue[];
    return (
      <div className="ml-4">
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-white/50 p-1.5 -ml-1.5 rounded-md group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpandable && (
            <span className="text-gray-400 group-hover:text-gray-600">
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </span>
          )}
          <ValueLabel type="array" />
          <span className="text-gray-500">[{arrayValue.length} items]</span>
        </div>
        {isExpanded && (
          <div className="ml-4 border-l border-gray-200 pl-4 space-y-2 mt-2">
            {arrayValue.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-gray-400 text-xs font-mono min-w-[2rem]">
                  {index}:
                </span>
                <SettingValue value={item} level={level + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (valueType === "object") {
    const objectValue = value as Record<string, JsonValue>;
    const entries = Object.entries(objectValue);
    return (
      <div className="ml-4">
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-white/50 p-1.5 -ml-1.5 rounded-md group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpandable && (
            <span className="text-gray-400 group-hover:text-gray-600">
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </span>
          )}
          <ValueLabel type="object" />
          <span className="text-gray-500">{entries.length} keys</span>
        </div>
        {isExpanded && (
          <div className="ml-4 border-l border-gray-200 pl-4 space-y-2 mt-2">
            {entries.map(([key, val]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="text-gray-600 font-medium text-sm min-w-[8rem] pt-1">
                  {key}:
                </span>
                <SettingValue value={val} level={level + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default SettingValue;
