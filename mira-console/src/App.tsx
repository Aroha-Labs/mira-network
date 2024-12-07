import Sidebar from "./components/Sidebar";
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
      <Sidebar />
      <div className="flex flex-col flex-1">{props.children}</div>
    </div>
  );
}

export default App;
