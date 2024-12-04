import { useState } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";

interface CodeBlockProps {
  children: string;
  className?: string;
}

const CodeBlock = ({ children, className }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const language = className?.replace(/language-/, "") || "text";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlighted = Prism.highlight(
    children,
    Prism.languages[language] || Prism.languages.text,
    language
  );

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2">
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded hover:bg-gray-200"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="absolute left-2 top-2">
        <span className="text-xs font-mono text-gray-500">{language}</span>
      </div>
      <pre className="mt-6 bg-gray-900 rounded-lg p-4 overflow-x-auto">
        <code
          className={`language-${language} text-sm`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
};

export default CodeBlock;
