import { useState, useEffect } from "react";
import { FunctionDefinition, Tool, ToolParameter } from "src/utils/chat";

interface ToolEditModalProps {
  tool?: Tool;
  onSave: (tool: Tool) => void;
  onClose: () => void;
}

const defaultParameters = {
  type: "object" as const,
  properties: {},
  required: [] as string[],
};

interface ParameterEditorProps {
  parameter: ToolParameter;
  onChange: (param: ToolParameter) => void;
  onDelete: () => void;
  name: string;
  onNameChange: (newName: string) => void;
  isRequired: boolean;
  onRequiredChange: (required: boolean) => void;
}

const ParameterEditor = ({
  parameter,
  onChange,
  onDelete,
  name,
  onNameChange,
  isRequired,
  onRequiredChange,
}: ParameterEditorProps) => {
  const [localName, setLocalName] = useState(name);
  const [localDescription, setLocalDescription] = useState(parameter.description);

  const handleNameBlur = () => {
    if (localName !== name) {
      onNameChange(localName);
    }
  };

  const handleDescriptionBlur = () => {
    if (localDescription !== parameter.description) {
      onChange({ ...parameter, description: localDescription });
    }
  };

  useEffect(() => {
    setLocalName(name);
  }, [name]);

  useEffect(() => {
    setLocalDescription(parameter.description);
  }, [parameter.description]);

  return (
    <div className="border rounded-md p-3 mb-2">
      <div className="flex justify-between mb-2">
        <input
          type="text"
          value={localName}
          className="px-2 py-1 border rounded"
          placeholder="Parameter name"
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleNameBlur}
        />
        <button onClick={onDelete} className="text-red-600 hover:text-red-800">
          Remove
        </button>
      </div>

      <div className="space-y-2">
        <select
          value={parameter.type}
          onChange={(e) =>
            onChange({ ...parameter, type: e.target.value as ToolParameter["type"] })
          }
          className="w-full px-2 py-1 border rounded"
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="array">Array</option>
          <option value="object">Object</option>
        </select>

        <textarea
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          className="w-full px-2 py-1 border rounded"
          placeholder="Parameter description"
          rows={2}
        />

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={isRequired}
            onChange={(e) => onRequiredChange(e.target.checked)}
            className="mr-2"
          />
          Required
        </label>

        {parameter.type === "array" && (
          <div className="ml-4 border-l-2 pl-2">
            <h4 className="text-sm font-medium mb-1">Array Items</h4>
            <select
              value={parameter.items?.type || "string"}
              onChange={(e) =>
                onChange({
                  ...parameter,
                  items: {
                    type: e.target.value,
                  },
                })
              }
              className="w-full px-2 py-1 border rounded"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="object">Object</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default function ToolEditModal({ tool, onSave, onClose }: ToolEditModalProps) {
  const [name, setName] = useState(tool?.function?.name || "");
  const [description, setDescription] = useState(tool?.function?.description || "");
  const [parameters, setParameters] = useState<FunctionDefinition["parameters"]>(
    tool?.function?.parameters || defaultParameters
  );

  const handleAddParameter = () => {
    const newParam: ToolParameter = {
      type: "string",
      description: "",
    };
    const paramName = `param${Object.keys(parameters.properties).length + 1}`;
    setParameters({
      ...parameters,
      properties: {
        ...parameters.properties,
        [paramName]: newParam,
      },
    });
  };

  const handleParameterChange = (name: string, param: ToolParameter) => {
    setParameters({
      ...parameters,
      properties: {
        ...parameters.properties,
        [name]: param,
      },
    });
  };

  const handleParameterDelete = (name: string) => {
    const { [name]: _, ...rest } = parameters.properties;
    setParameters({
      ...parameters,
      properties: rest,
      required: parameters.required.filter((req) => req !== name),
    });
  };

  const handleParameterNameChange = (oldName: string, newName: string) => {
    const { [oldName]: param, ...rest } = parameters.properties;
    setParameters({
      ...parameters,
      properties: {
        ...rest,
        [newName]: param,
      },
      required: parameters.required.map((req) => (req === oldName ? newName : req)),
    });
  };

  const handleRequiredChange = (name: string, isRequired: boolean) => {
    setParameters({
      ...parameters,
      required: isRequired
        ? [...parameters.required, name]
        : parameters.required.filter((n) => n !== name),
    });
  };

  const handleSave = () => {
    const toolDict = {
      type: "function",
      function: {
        name,
        description,
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(parameters.properties).map(([key, param]) => [
              key,
              {
                type: param.type,
                description: param.description,
                ...(param.type === "array" && param.items ? { items: param.items } : {}),
              },
            ])
          ),
          required: parameters.required,
        },
      },
    };

    onSave(toolDict);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          {tool ? "Edit Tool" : "Add New Tool"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Enter tool name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
              placeholder="Enter tool description"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Parameters
              </label>
              <button
                onClick={handleAddParameter}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add Parameter
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(parameters.properties).map(([name, param]) => (
                <ParameterEditor
                  key={name}
                  name={name}
                  parameter={param}
                  onChange={(newParam) => handleParameterChange(name, newParam)}
                  onDelete={() => handleParameterDelete(name)}
                  onNameChange={(newName) => handleParameterNameChange(name, newName)}
                  isRequired={parameters.required.includes(name)}
                  onRequiredChange={(isRequired) =>
                    handleRequiredChange(name, isRequired)
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
