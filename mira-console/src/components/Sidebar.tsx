import "./sidebar.css";
import { useStateSidebarOpen } from "../recoil/atoms";

interface SidebarProps {
  children?: React.ReactNode;
}

const Sidebar = (props: SidebarProps) => {
  const [sidebarOpen, setSidebarOpen] = useStateSidebarOpen();

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="sidebar bg-gray-800 text-white w-64 min-h-screen fixed top-0 left-0 md:relative md:flex md:flex-col z-50">
        {props.children}
      </div>
    </>
  );
};

export default Sidebar;
