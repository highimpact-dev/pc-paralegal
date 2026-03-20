import ReactMarkdown from "react-markdown";

interface MarkdownProps {
  content: string;
}

export default function Markdown({ content }: MarkdownProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-relaxed prose-li:leading-relaxed prose-pre:bg-gray-100 dark:prose-pre:bg-dark-card prose-code:text-sm">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
