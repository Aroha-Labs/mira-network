import { useMemo } from "react";
import { useStateSidebarOpen } from "../recoil/atoms";
import { Link } from "@tanstack/react-router";

interface HeaderProps {
  left?: React.ReactNode;
}

const Header = ({ left }: HeaderProps) => {
  const title = useMemo(() => {
    if (typeof left === "string") {
      return <div className="text-xl flex items-center text-white">{left}</div>;
    }

    return left;
  }, [left]);

  const [_, setIsSidebarOpen] = useStateSidebarOpen();

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <header className="bg-blue-600 p-4 flex justify-between items-center">
      <div>{title}</div>
      <button className="md:hidden text-white" onClick={handleToggleSidebar}>
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 6h16M4 12h16m-7 6h7"
          ></path>
        </svg>
      </button>

      <div className="flex-1"></div>

      <div className="flex items-center gap-4">
        <Link href="/" className="text-white">
          Flows
        </Link>
        <Link href="/verify" className="text-white">
          Verify
        </Link>
      </div>
    </header>
  );
};

export default Header;
