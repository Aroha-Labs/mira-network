import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "./Pagination";

// Component to handle individual pagination items
const PaginationItems = ({
  currentPage,
  totalPages,
  handlePageChange,
}: {
  currentPage: number;
  totalPages: number;
  handlePageChange: (page: number) => void;
}) => {
  const items = [];

  // Always show the first page
  items.push(
    <PaginationItem
      className="cursor-pointer"
      key={1}
      onClick={() => handlePageChange(1)}
    >
      <PaginationButton isActive={currentPage === 1}>1</PaginationButton>
    </PaginationItem>
  );

  // Show ellipsis if currentPage is greater than 3
  if (currentPage > 2) {
    items.push(
      <PaginationItem key="ellipsis-start">
        <PaginationEllipsis />
      </PaginationItem>
    );
  }

  // Show current page
  if (currentPage > 1 && currentPage < totalPages) {
    items.push(
      <PaginationItem
        className="cursor-pointer"
        key={currentPage}
        onClick={() => handlePageChange(currentPage)}
      >
        <PaginationButton isActive={true}>{currentPage}</PaginationButton>
      </PaginationItem>
    );
  }

  // Show ellipsis if there are more pages after the current page
  if (currentPage < totalPages - 1) {
    items.push(
      <PaginationItem key="ellipsis-end">
        <PaginationEllipsis />
      </PaginationItem>
    );
  }

  // Always show the last page
  if (totalPages > 1) {
    items.push(
      <PaginationItem
        className="cursor-pointer"
        key={totalPages}
        onClick={() => handlePageChange(totalPages)}
      >
        <PaginationButton isActive={currentPage === totalPages}>
          {totalPages}
        </PaginationButton>
      </PaginationItem>
    );
  }

  return <>{items}</>;
};

const CustomPagination = ({
  totalPages,
  currentPage,
  handlePageChange,
}: {
  totalPages: number;
  currentPage: number;
  handlePageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;
  return (
    <Pagination className="mt-8 justify-end">
      <PaginationContent className="flex items-start">
        {currentPage > 1 && (
          <PaginationItem
            className="cursor-pointer"
            onClick={() => handlePageChange(currentPage - 1)}
          >
            <PaginationPrevious />
          </PaginationItem>
        )}
        <PaginationItems
          currentPage={currentPage}
          totalPages={totalPages}
          handlePageChange={handlePageChange}
        />
        {currentPage < totalPages && (
          <PaginationItem
            className="cursor-pointer"
            onClick={() => handlePageChange(currentPage + 1)}
          >
            <PaginationNext />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
};

export default CustomPagination;
