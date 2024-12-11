import "./sidebar.css";

interface SidebarProps {
  children?: React.ReactNode;
}

const Sidebar = (props: SidebarProps) => {
  return (
    <div className="sidebar bg-gray-800 text-white w-64 min-h-screen fixed top-0 left-0 md:relative md:flex md:flex-col z-50">
      {props.children}
    </div>
  );
};

export default Sidebar;
