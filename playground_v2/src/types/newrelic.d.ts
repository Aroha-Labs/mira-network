declare global {
  interface Window {
    newrelic: {
      noticeError: (error: Error) => void;
      // Add other NewRelic methods as needed
    };
  }
}

export {};
