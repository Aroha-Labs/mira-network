import LoggedoutFooter from "src/components/Footer";
import LoggedoutCard from "./LoggedoutCard";
import LoggedoutHeader from "./LoggedoutHeader";

const LoggedoutState = () => (
  <div className="max-w-[400px] w-full">
    <LoggedoutHeader />
    <LoggedoutCard />
    <LoggedoutFooter />
  </div>
);

export default LoggedoutState;
