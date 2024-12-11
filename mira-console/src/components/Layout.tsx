import Header from "./Header";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  headerLeft: React.ReactNode;
}

const Layout = ({ children, sidebar, headerLeft }: LayoutProps) => {
  return (
    <>
      {sidebar ? <Sidebar>{sidebar}</Sidebar> : null}
      <div className="flex flex-col flex-1">
        <Header left={headerLeft} />
        {children}
      </div>
    </>
  );
};

export default Layout;
