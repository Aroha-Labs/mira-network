import Link from "next/link";
import Card from "src/components/card";
import useApiTokens from "src/hooks/useApiTokens";
import { Button } from "../button";

const ManageApiKey = () => {
  const { data, error, isLoading } = useApiTokens();
  return (
    <Card>
      <div className="flex justify-between items-center p-4">
        <Link href="/api-keys">
          <Button className="bg-[#E9E9E9] text-[#303030] hover:bg-[#D7D7D7] hover:text-[#202020]">
            &gt;&gt; Manage API Keys
          </Button>
        </Link>
        {error || isLoading ? (
          <p className="text-[#303030] text-sm font-bold opacity-50">_ _</p>
        ) : (
          <p className="text-[#303030] text-sm font-bold opacity-50">
            {data?.total ?? 0} Keys
          </p>
        )}
      </div>
    </Card>
  );
};

export default ManageApiKey;
