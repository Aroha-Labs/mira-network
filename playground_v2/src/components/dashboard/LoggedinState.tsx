import { AuthUser } from "src/lib/auth-client";
import Footer from "../Footer";
import Analytics from "./AnalyticsCard";
import ApiLogs from "./ApiLogs";
import Credit from "./Credit";
import ManageApiKey from "./ManageApiKey";
import UserInfo from "./UserInfo";
import Verify from "./Verify";

interface LoggedinStateProps {
  user: AuthUser;
}

const LoggedinState = ({ user }: LoggedinStateProps) => (
  <div className="max-w-[710px] w-full">
    <UserInfo user={user} />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
      <div className="space-y-[36px]">
        <Analytics />
        <Footer className="hidden md:block col-span-2" />
      </div>
      <div className="space-y-1">
        <Credit />
        <ManageApiKey />
        <Verify />
        <ApiLogs />
      </div>
      <Footer className="block md:hidden" />
    </div>
  </div>
);

export default LoggedinState;
