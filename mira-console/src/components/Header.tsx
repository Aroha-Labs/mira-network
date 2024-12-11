import { useMemo, useState } from "react";
import { useStateSidebarOpen } from "../recoil/atoms";
import { Link } from "@tanstack/react-router";
import {
  ChartBarIcon,
  CheckBadgeIcon,
  ComputerDesktopIcon,
  Bars3Icon,
  XMarkIcon,
  EllipsisHorizontalCircleIcon,
} from "@heroicons/react/24/outline";

interface HeaderProps {
  left?: React.ReactNode;
  sidebarToggleButtonVisible: boolean;
}

const Header = ({ left, sidebarToggleButtonVisible }: HeaderProps) => {
  const title = useMemo(() => {
    if (typeof left === "string") {
      return <div className="text-xl flex items-center text-white">{left}</div>;
    }
    return left;
  }, [left]);

  const [_, setIsSidebarOpen] = useStateSidebarOpen();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <header className="bg-blue-600 p-4 flex justify-between items-center">
      <div className="flex items-center gap-4">
        {sidebarToggleButtonVisible ? (
          <button
            onClick={handleToggleSidebar}
            className="md:hidden text-white hover:text-blue-300 p-1"
            aria-label="Toggle sidebar"
          >
            <EllipsisHorizontalCircleIcon className="w-6 h-6" />
          </button>
        ) : null}
        {title}
      </div>

      <div className="flex-1"></div>

      <>
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8 pr-6">
          <Link
            href="/"
            className="text-white hover:text-blue-300 flex items-center gap-2"
          >
            <ChartBarIcon className="w-5 h-5" />
            Flows
          </Link>
          <Link
            href="/verify"
            className="text-white hover:text-blue-300 flex items-center gap-2"
          >
            <CheckBadgeIcon className="w-5 h-5" />
            Verify
          </Link>
          <Link
            href="/machines"
            className="text-white hover:text-blue-300 flex items-center gap-2"
          >
            <ComputerDesktopIcon className="w-5 h-5" />
            Machines
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white p-2"
          >
            {isMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="absolute top-16 left-0 right-0 bg-gray-800 md:hidden">
            <div className="flex flex-col p-4 space-y-4">
              <Link
                href="/"
                className="text-white hover:text-blue-300 flex items-center gap-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <ChartBarIcon className="w-5 h-5" />
                Flows
              </Link>
              <Link
                href="/verify"
                className="text-white hover:text-blue-300 flex items-center gap-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <CheckBadgeIcon className="w-5 h-5" />
                Verify
              </Link>
              <Link
                href="/machines"
                className="text-white hover:text-blue-300 flex items-center gap-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <ComputerDesktopIcon className="w-5 h-5" />
                Machines
              </Link>
            </div>
          </div>
        )}
      </>
    </header>
  );
};

export default Header;
