import { Session } from "@supabase/supabase-js";
import Footer from "../Footer";
import Analytics from "./AnalyticsCard";
import ApiLogs from "./ApiLogs";
import Credit from "./Credit";
import ManageApiKey from "./ManageApiKey";
import Network from "./Network";
import UserInfo from "./UserInfo";

interface LoggedinStateProps {
  userSession: Session;
}

const LoggedinState = ({ userSession }: LoggedinStateProps) => (
  <div className="max-w-[710px] w-full">
    <UserInfo user={userSession?.user} />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Analytics userSession={userSession} />
        <Footer className="hidden md:block col-span-2" />
      </div>
      <div className="space-y-4">
        <Credit />
        <ManageApiKey />
        <ApiLogs />
        <Network />
      </div>
      <Footer className="block md:hidden" />
    </div>
  </div>
);

export default LoggedinState;
