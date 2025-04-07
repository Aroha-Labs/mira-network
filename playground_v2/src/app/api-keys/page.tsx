"use client";

import { useStore } from "@tanstack/react-store";
import { useEffect, useState } from "react";
import ApiKeyTable from "src/components/ApiKeys/ApiKeyTable";
import Header from "src/components/ApiKeys/Header";
import Footer from "src/components/Footer";
import Pagination from "src/components/Pagination";
import useApiTokens from "src/hooks/useApiTokens";
import {
  apiKeysParamsState,
  DEFAULT_PARAMS,
} from "src/state/apiKeysParamsState";

const ApiKeysPage = () => {
  const params = useStore(apiKeysParamsState, (state) => state);
  const { data, isLoading, error } = useApiTokens();

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    apiKeysParamsState.setState(() => DEFAULT_PARAMS);
  }, []);

  return (
    <div className="container mx-auto p-4 w-[720px]">
      <Header />
      <div className={isModalOpen ? "opacity-40" : ""}>
        <ApiKeyTable
          setIsModalOpen={setIsModalOpen}
          data={
            data ?? {
              items: [],
              total: 0,
              page: 1,
              page_size: 1,
              total_pages: 1,
            }
          }
          isLoading={isLoading}
          error={error}
        />
        <div className="flex justify-between">
          <Footer />
          <Pagination
            currentPage={params.page ?? 1}
            pageSize={data?.page_size ?? 1}
            totalRecords={data?.total ?? 0}
            handlePageChange={(pageNumber) =>
              apiKeysParamsState.setState(() => ({
                ...params,
                page: pageNumber,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
};

export default ApiKeysPage;
