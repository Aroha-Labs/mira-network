import Card from "src/components/card";
import LoginWithGoogle from "src/components/LoginWithGoogle";

const LoggedoutCardContent = () => {
  return (
    <Card>
      <div className="p-4 flex flex-col gap-[216px]">
        <div>
          <h2 className="font-jetbrains-mono text-lg font-bold leading-[22px]">
            trustless, verified <br /> intelligence
          </h2>
          <h3 className="font-jetbrains-mono text-sm font-bold text-[#9C9B9B] mt-[12px]">
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
