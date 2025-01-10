interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total?: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  page,
  pageSize,
  total,
  onNextPage,
  onPreviousPage,
}) => (
  <div className="flex justify-between mt-4">
    <button
      className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
      onClick={onPreviousPage}
      disabled={page === 1}
    >
      Previous
    </button>
    <button
      className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
      onClick={onNextPage}
      disabled={Boolean(total && page >= Math.ceil(total / pageSize))}
    >
      Next
    </button>
  </div>
);

export default PaginationControls;
