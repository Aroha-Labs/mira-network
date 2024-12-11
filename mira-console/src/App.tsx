import { useValueSidebarOpen } from "./recoil/atoms";
import clsx from "clsx";

interface AppProps {
  children?: React.ReactNode;
}

function App(props: AppProps) {
  const isSidebarOpen = useValueSidebarOpen();

  return (
    <div
      className={clsx("flex flex-col min-h-screen md:flex-row", {
        "sidebar-open": isSidebarOpen,
      })}
    >
      {props.children}
    </div>
  );
}

export default App;
