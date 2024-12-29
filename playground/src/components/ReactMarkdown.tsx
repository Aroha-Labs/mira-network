import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReactMarkdownProps extends React.ComponentProps<typeof Markdown> {
  children: string;
}

const ReactMarkdown = ({
  children,
  remarkPlugins = [],
  ...props
}: ReactMarkdownProps) => {
  return (
    <Markdown remarkPlugins={[remarkGfm, ...remarkPlugins!]} {...props}>
      {children}
    </Markdown>
  );
};

export default ReactMarkdown;
