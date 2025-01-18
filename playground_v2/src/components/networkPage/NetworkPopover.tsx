import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import ActiveMachines from "./ActiveMachines";
import TotalInferenceCalls from "./TotalInferenceCalls";
import TotalTokens from "./TotalTokens";

const NetworkPopover = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <p>Network</p>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex gap-4 items-center flex-wrap w-full">
          <TotalInferenceCalls />
          <TotalTokens />
          <ActiveMachines />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NetworkPopover;
