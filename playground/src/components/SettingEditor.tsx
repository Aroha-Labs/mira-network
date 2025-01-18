import { useRef, useState, useEffect } from "react";
import {
  TrashIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import { ValueType, JsonValue, JsonObject, JsonArray } from "src/types/json";
import ConfirmationPopup from "./ConfirmationPopup";

interface SettingEditorProps {
  value: JsonObject;
  onChange: (value: JsonObject) => void;
  disabled?: boolean;
}

const TypeSelector = ({
  value,
  onChange,
}: {
  value: ValueType;
  onChange: (type: ValueType) => void;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as ValueType)}
    className="text-sm border rounded px-2 py-1"
  >
    <option value="string">String</option>
    <option value="number">Number</option>
    <option value="boolean">Boolean</option>
    <option value="array">Array</option>
    <option value="object">Object</option>
  </select>
);

const getDefaultValueForType = (type: ValueType) => {
  switch (type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
  }
};

const getValueType = (value: unknown): ValueType => {
  if (Array.isArray(value)) return "array";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "object" && value !== null) return "object";
  return "string";
};

const AutoResizeTextarea = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="border rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed min-w-[60px] resize-none overflow-hidden"
      rows={1}
      style={{ minHeight: "28px" }}
    />
  );
};

const JsonValueEditor = ({
  value,
  type,
  onChange,
  disabled,
}: {
  value: JsonValue;
  type: ValueType;
  onChange: (value: JsonValue) => void;
  disabled?: boolean;
}) => {
  switch (type) {
    case "string":
      return (
        <AutoResizeTextarea
          value={value as string}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={value as number}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 border rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={disabled}
        />
      );
    case "boolean":
      return (
        <input
          type="checkbox"
          checked={value as boolean}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5"
          disabled={disabled}
        />
      );
    case "array":
      return (
        <ArrayEditor
          value={value as JsonArray}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "object":
      return (
        <NestedObjectEditor
          value={value as JsonObject}
          onChange={onChange}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
};

const DeleteButton = ({
  onDelete,
  disabled,
  parentRef,
}: {
  onDelete: () => void;
  disabled?: boolean;
  parentRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setShowConfirm(true)}
        className="text-red-500 hover:text-red-600 disabled:opacity-50 p-1"
        disabled={disabled}
        onMouseEnter={() => parentRef.current?.classList.add("bg-red-50")}
        onMouseLeave={() => parentRef.current?.classList.remove("bg-red-50")}
      >
        <TrashIcon className="h-5 w-5" />
      </button>
      {showConfirm && (
        <ConfirmationPopup
          title="Confirm delete?"
          onConfirm={() => {
            onDelete();
            setShowConfirm(false);
          }}
          onCancel={() => setShowConfirm(false)}
          triggerRef={buttonRef}
        />
      )}
    </>
  );
};

const ValueRow = ({
  keyName,
  value,
  onChange,
  onDelete,
  disabled,
  level = 0,
  isExpanded,
  onToggleExpand,
}: {
  keyName: string;
  value: JsonValue;
  onChange: (value: JsonValue) => void;
  onDelete: () => void;
  disabled?: boolean;
  level?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const valueType = getValueType(value);
  const isExpandable = valueType === "object" || valueType === "array";

  return (
    <div
      ref={rowRef}
      className="flex flex-col gap-1 p-1 rounded transition-colors duration-150"
    >
      <div className="flex items-center gap-2">
        <div className="font-medium">{keyName}</div>
        <TypeSelector
          value={valueType}
          onChange={(type) => onChange(getDefaultValueForType(type))}
        />
        {isExpandable && onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-gray-100 rounded"
            disabled={disabled}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </button>
        )}
        {!isExpandable && (
          <JsonValueEditor
            value={value}
            type={valueType}
            onChange={onChange}
            disabled={disabled}
          />
        )}
        <DeleteButton
          onDelete={onDelete}
          disabled={disabled}
          parentRef={rowRef}
        />
      </div>
      {isExpanded && isExpandable && (
        <div className="ml-4">
          {valueType === "object" ? (
            <NestedObjectEditor
              value={value as JsonObject}
              onChange={onChange}
              level={level + 1}
              disabled={disabled}
            />
          ) : (
            <ArrayEditor
              value={value as JsonArray}
              onChange={onChange}
              level={level + 1}
              disabled={disabled}
            />
          )}
        </div>
      )}
    </div>
  );
};

const NestedObjectEditor = ({
  value,
  onChange,
  level = 0,
  disabled,
}: {
  value: JsonObject;
  onChange: (value: JsonObject) => void;
  level?: number;
  disabled?: boolean;
}) => {
  const [newKey, setNewKey] = useState("");
  const [expandedObjects, setExpandedObjects] = useState<
    Record<string, boolean>
  >({});

  const handleAddKey = () => {
    if (newKey && !(newKey in value)) {
      onChange({ ...value, [newKey]: "" });
      setNewKey("");
    }
  };

  return (
    <div className={`space-y-1 ${level > 0 ? "ml-2 border-l pl-2" : ""}`}>
      <div className="flex gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="New key"
          className="flex-1 border rounded px-2 py-1"
          disabled={disabled}
        />
        <button
          onClick={handleAddKey}
          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          disabled={disabled}
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      {Object.entries(value).map(([key, val]) => (
        <ValueRow
          key={key}
          keyName={key}
          value={val}
          onChange={(newVal) => onChange({ ...value, [key]: newVal })}
          onDelete={() => {
            const newValue = { ...value };
            delete newValue[key];
            onChange(newValue);
          }}
          disabled={disabled}
          level={level}
          isExpanded={expandedObjects[key]}
          onToggleExpand={() =>
            setExpandedObjects((prev) => ({
              ...prev,
              [key]: !prev[key],
            }))
          }
        />
      ))}
    </div>
  );
};

const ArrayEditor = ({
  value,
  onChange,
  level = 0,
  disabled,
}: {
  value: JsonArray;
  onChange: (value: JsonArray) => void;
  level?: number;
  disabled?: boolean;
}) => {
  const handleAddItem = () => onChange([...value, ""]);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>(
    {}
  );

  const toggleExpand = (index: number) => {
    setExpandedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className={`space-y-1 ${level > 0 ? "ml-2 border-l pl-2" : ""}`}>
      <button
        onClick={handleAddItem}
        className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-sm"
        disabled={disabled}
      >
        <PlusIcon className="h-4 w-4" />
      </button>

      {value.map((item, index) => (
        <ValueRow
          key={index}
          keyName={`[${index}]`}
          value={item}
          onChange={(newVal) => {
            const newValue = [...value];
            newValue[index] = newVal;
            onChange(newValue);
          }}
          onDelete={() => onChange(value.filter((_, i) => i !== index))}
          disabled={disabled}
          level={level}
          isExpanded={expandedItems[index]}
          onToggleExpand={() => toggleExpand(index)}
        />
      ))}
    </div>
  );
};

const RawJsonEditor = ({
  value,
  onChange,
  onCancel,
  disabled,
}: {
  value: JsonObject;
  onChange: (value: JsonObject) => void;
  onCancel: () => void;
  disabled?: boolean;
}) => {
  const [jsonString, setJsonString] = useState(() =>
    JSON.stringify(value, null, 2)
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonString);
      onChange(parsed);
      onCancel();
    } catch (e: unknown) {
      console.log(e);
      setError("Invalid JSON format");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-red-500">{error}</div>
        <div className="space-x-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
            disabled={disabled}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
            disabled={disabled}
          >
            Apply Changes
          </button>
        </div>
      </div>
      <textarea
        value={jsonString}
        onChange={(e) => {
          setJsonString(e.target.value);
          setError(null);
        }}
        className="w-full h-[400px] font-mono text-sm p-3 border rounded focus:ring-1 focus:ring-blue-500"
        disabled={disabled}
      />
    </div>
  );
};

const SettingEditor = ({ value, onChange, disabled }: SettingEditorProps) => {
  const [showRawEditor, setShowRawEditor] = useState(false);

  if (showRawEditor) {
    return (
      <RawJsonEditor
        value={value}
        onChange={onChange}
        onCancel={() => setShowRawEditor(false)}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowRawEditor(true)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
          disabled={disabled}
        >
          <CodeBracketIcon className="h-4 w-4" />
          Edit as JSON
        </button>
      </div>
      <NestedObjectEditor
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
};

export default SettingEditor;
