import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// type CodeProps = ComponentPropsWithoutRef<"code"> & { inline?: boolean };

interface ReactMarkdownProps extends React.ComponentProps<typeof Markdown> {
  children: string;
}

const ReactMarkdown = ({
  children,
  remarkPlugins = [],
  components = {},
  ...props
}: ReactMarkdownProps) => {
  return (
    <Markdown
      remarkPlugins={[remarkGfm, ...remarkPlugins!]}
      components={{
        // pre: ({ node, children, ...props }) => (
        //   <div className="relative group">
        //     <pre {...props}>{children}</pre>
        //     <button
        //       onClick={() => {
        //         console.log(children.props.children);

        //         const preElement = children?.toString() || "";
        //         navigator.clipboard.writeText(preElement);
        //       }}
        //       className="absolute p-1 text-gray-200 transition-opacity bg-gray-700 rounded-sm opacity-0 top-2 right-2 group-hover:opacity-100"
        //     >
        //       <ClipboardIcon className="w-4 h-4" />
        //     </button>
        //   </div>
        // ),
        // code: ({ inline, className, children, ...props }: CodeProps) => (
        //   <code className={className} {...props}>
        //     {children}
        //   </code>
        // ),
        ...components,
      }}
      {...props}
    >
      {children}
    </Markdown>
  );
};

export default ReactMarkdown;
