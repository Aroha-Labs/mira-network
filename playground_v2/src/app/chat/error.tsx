"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

const ErrorComponent = ({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) => {
  useEffect(() => {
    const nr = window.newrelic;
    if (nr) {
      nr.noticeError(error);
    }
    console.error(error);
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </button>
    </div>
  );
};

export default ErrorComponent;
