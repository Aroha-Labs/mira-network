import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "src/lib/utils";
import "./textArea.css";

interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxHeight?: number;
}

const TextArea = ({
  value,
  onChange,
  maxHeight = 190, // Default max height in pixels
  className,
  ...props
}: TextAreaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showBlur, setShowBlur] = useState(false);
  const lastScrollTopRef = useRef(0);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTypingTimer = useCallback(() => {
    isTypingRef.current = true;
    setShowBlur(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 500);
  }, []);

  const adjustHeight = useCallback(
    (element: HTMLTextAreaElement) => {
      // Reset height to auto to get the correct scrollHeight for the content
      element.style.height = "auto";

      // Get the scroll height after resetting
      const scrollHeight = element.scrollHeight;

      // Set the new height based on content, bounded by maxHeight
      const newHeight = Math.min(scrollHeight, maxHeight);
      element.style.height = `${newHeight}px`;

      // Toggle overflow based on content height
      element.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
    },
    [maxHeight]
  );

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight(textareaRef.current);
      // Reset scroll position and state when content changes
      textareaRef.current.scrollTop = 0;
      lastScrollTopRef.current = 0;
      resetTypingTimer();
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [value, adjustHeight, resetTypingTimer]);

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    adjustHeight(target);
    resetTypingTimer();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e);
    resetTypingTimer();
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const currentScrollTop = target.scrollTop;
    const isScrollingDown = currentScrollTop > lastScrollTopRef.current;

    if (!isTypingRef.current) {
      setShowBlur(isScrollingDown);
    }

    lastScrollTopRef.current = currentScrollTop;
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        rows={1}
        style={{
          height: "auto",
          maxHeight: `${maxHeight}px`,
          resize: "none",
          minHeight: "29px", // Ensures a minimum height
        }}
        className={cn(
          "textArea w-full",
          "bg-transparent focus:outline-hidden text-[12px] font-[400] leading-[18px] tracking-[-0.013em] text-left decoration-skip-ink-none opacity-[60%]",
          className
        )}
        onInput={handleInput}
        onScroll={handleScroll}
        {...props}
      />
      {showBlur && (
        <div
          className="absolute bottom-0 left-0 w-[399px] h-[54px]"
          style={{
            backdropFilter: "blur(2px)",
            background:
              "linear-gradient(180deg, rgba(241, 247, 245, 0) 0%, #F1F7F5 100%)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

export default TextArea;
