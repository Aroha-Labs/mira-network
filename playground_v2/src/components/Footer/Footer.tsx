import cn from "clsx";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import jetBrainsMono from "src/app/fonts/jetBrainsMono";

const inter = Inter({ subsets: ["latin"] });

const links = [
  {
    text: "SDK",
    href: "https://flow-docs.mira.network/documentation/get-started/introduction",
  },
  {
    text: "DISCORD",
    href: "https://discord.com/invite/mira-network",
  },
  {
    text: "X",
    href: "https://x.com/Mira_Network",
  },
  {
    text: "ABOUT",
    href: "https://mira.network/about",
  },
];

const Footer = ({ className }: { className?: string }) => (
  <div className={cn("mt-8", className)}>
    <div className="flex gap-[24px] mb-4">
      {links.map(({ text, href }) => (
        <Link
          key={text}
          href={href}
          className={cn(
            jetBrainsMono.className,
            "text-base text-black font-medium opacity-50 leading-[22px] tracking-[-0.013em] text-left underline decoration-solid underline-from-font decoration-skip-ink-auto"
          )}
        >
          {text}
        </Link>
      ))}
    </div>
    <div className="flex h-[48px] w-full items-center opacity-60">
      <div className="flex items-center justify-center p-4 bg-white border border-solid border-[#DADADA]">
        <Image src="/img/logo.svg" alt="Left Logo" width={24} height={24} />
      </div>
      <span
        className={cn(
          inter.className,
          "ml-4 text-xs font-medium opacity-60 text-black"
        )}
      >
        ©2024 Aroha Labs. All rights reserved.
      </span>
    </div>
  </div>
);

export default Footer;
