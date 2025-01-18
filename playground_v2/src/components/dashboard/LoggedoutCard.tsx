import Card from "src/components/card";
import LoginWithGoogle from "src/components/LoginWithGoogle";

const LoggedoutCardContent = () => {
  return (
    <Card>
      <div className="p-4 flex flex-col gap-[216px]">
        <div>
          <h2 className="text-[18px] font-[700] leading-[21.6px] text-[#303030]">
            trustless, verified <br /> intelligence
          </h2>
          <h3 className="text-[14px] font-[700] leading-[16.8px] text-[#9C9B9B] mt-[12px] font-['JetBrains_Mono']">
            now as an api
          </h3>
        </div>
        <div className="flex">
          <LoginWithGoogle />
        </div>
      </div>
    </Card>
  );
};

export default LoggedoutCardContent;
