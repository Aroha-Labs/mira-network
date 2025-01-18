import React from "react";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export const Spinner = ({ className = "", size = "md" }: SpinnerProps) => (
  <svg
    className={`animate-spin ${sizeClasses[size]} text-current ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    ></path>
  </svg>
);

interface PageLoadingProps {
  text?: string;
  className?: string;
  size?: SpinnerProps["size"];
  fullPage?: boolean;
}

export default function PageLoading({
  text,
  className = "",
  size = "md",
  fullPage = false,
}: PageLoadingProps) {
  const content = (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Spinner size={size} />
      {text && <div className="text-gray-700 text-lg">{text}</div>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center flex-1 bg-gray-100">{content}</div>
    );
  }

  return content;
}
