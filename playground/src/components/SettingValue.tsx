import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import { JsonValue } from "src/types/json";

interface SettingValueProps {
  value: JsonValue;
  level?: number;
}

const ValueLabel = ({ type }: { type: string }) => (
  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
    {type}
  </span>
);

const SettingValue = ({ value, level = 0 }: SettingValueProps) => {
  const [isExpanded, setIsExpanded] = useState(level < 1);
  const [showRawJson, setShowRawJson] = useState(false);
  const valueType = Array.isArray(value) ? "array" : typeof value;
  const isExpandable = valueType === "object" || valueType === "array";
  const indent = level > 0 ? "ml-1" : "";

  // Show raw JSON view if enabled
  if (showRawJson && level === 0) {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <button
            onClick={() => setShowRawJson(false)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
          >
            <CodeBracketIcon className="h-4 w-4" />
            Show Formatted
          </button>
        </div>
        <pre className="bg-gray-50 p-3 rounded-md overflow-x-auto font-mono text-sm text-gray-800">
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );
  }

  // Show toggle for root level only
  if (level === 0) {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <button
            onClick={() => setShowRawJson(true)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
          >
            <CodeBracketIcon className="h-4 w-4" />
            Show Raw
          </button>
        </div>
        <RenderValue
          value={value}
          valueType={valueType}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          isExpandable={isExpandable}
          indent={indent}
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
      indent={indent}
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
  indent: string;
  level: number;
}

const RenderValue = ({
  value,
  valueType,
  isExpanded,
  setIsExpanded,
  isExpandable,
  indent,
  level,
}: RenderValueProps) => {
  if (value === null) return <span className="text-gray-400">null</span>;

  if (valueType === "string") {
    return (
      <div className="flex items-center gap-2">
        <ValueLabel type="string" />
        <span className="text-gray-800">&#34;{value as string}&#34;</span>
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
      <div className={indent}>
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpandable && (
            <span className="text-gray-400">
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
                <span className="text-gray-400 text-sm font-mono">
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
      <div className={indent}>
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpandable && (
            <span className="text-gray-400">
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
              <div key={key} className="flex items-center gap-2">
                <span className="text-gray-600 font-medium self-start ">
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
