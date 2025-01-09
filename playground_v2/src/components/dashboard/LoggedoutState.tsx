import LoggedoutFooter from "src/components/Footer";
import LoggedoutCard from "./LoggedoutCard";
import LoggedoutHeader from "./LoggedoutHeader";

const LoggedoutState = () => (
  <div className="flex flex-col items-center justify-center flex-1 p-4 space-y-4">
    <div className="max-w-[710px] w-full">
      <LoggedoutHeader />
      <LoggedoutCard />
      <LoggedoutFooter />
    </div>
  </div>
);

export default LoggedoutState;
