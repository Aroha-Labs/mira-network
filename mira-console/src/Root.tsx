import { RecoilRoot } from "recoil";
import App from "./App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

interface RootProps {
  children: React.ReactNode;
}

const Root = (props: RootProps) => {
  return (
    <RecoilRoot>
      <QueryClientProvider client={queryClient}>
        <App>{props.children}</App>
      </QueryClientProvider>
    </RecoilRoot>
  );
};

export default Root;
