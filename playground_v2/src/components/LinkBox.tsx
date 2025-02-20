import Link from "next/link";
import React from "react";

interface LinkBoxProps {
  href: string;
  label: string;
  isDisabled: boolean;
}

const LinkBox: React.FC<LinkBoxProps> = ({ href, label, isDisabled }) => {
  return isDisabled ? (
    <div className="bg-white p-4 shadow-sm w-full max-w-md flex justify-between items-center cursor-not-allowed opacity-50">
      <p className="text-gray-700">{label}</p>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  ) : (
    <Link
      href={href}
      className="bg-white p-4 shadow-sm w-full max-w-md flex justify-between items-center cursor-pointer hover:bg-gray-200 active:bg-gray-300 transition"
    >
      <p className="text-gray-700">{label}</p>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </Link>
  );
};

export default LinkBox;
