import { Button } from "src/components/button";

const Header = ({ onClose }: { onClose: () => void }) => {
	return (
		<div className="sticky top-0 flex flex-wrap items-center justify-between mb-8 z-10">
			<Button
				variant="link"
				className="flex items-center gap-3 cursor-pointer"
				onClick={onClose}
			>
				<span className="text-md">&gt;</span>
				<p className="text-md leading-[22px] tracking-[-0.013em]">Close</p>
			</Button>
			<div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-4 flex-1 h-[2px]" />
		</div>
	);
};

export default Header;
