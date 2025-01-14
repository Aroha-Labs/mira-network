import cn from "clsx";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import jetBrainsMono from "src/app/fonts/jetBrainsMono";

const inter = Inter({ subsets: ["latin"] });

const links = [
  {
    text: "SDK",
    href: "https://docs.mira.network",
    target: "_blank",
  },
  {
    text: "DISCORD",
    href: "https://discord.com/invite/mira-network",
    target: "_blank",
  },
  {
    text: "X",
    href: "https://x.com/Mira_Network",
    target: "_blank",
  },
  {
    text: "ABOUT",
    href: "https://mira.network/about",
    target: "_blank",
  },
];

const Footer = ({ className }: { className?: string }) => (
  <div className={cn("mt-8", className)}>
    <div className="flex gap-[24px] mb-4">
      {links.map(({ text, href, target }) => (
        <Link
          key={text}
          href={href}
          target={target}
          className={cn(
            jetBrainsMono.className,
            "text-[12px] text-[#000] opacity-60 font-medium leading-[22px] tracking-[-0.156px] underline decoration-solid underline-from-font decoration-skip-ink-auto"
          )}
        >
          {text}
        </Link>
      ))}
    </div>
    <div className="flex h-[48px] w-full items-center opacity-60">
      <div className="flex p-3 items-center gap-2 bg-white border border-solid border-[#DADADA]">
        <Image src="/img/logo.svg" alt="Left Logo" width={24} height={24} />
      </div>
      <span
        className={cn(
          inter.className,
          "ml-4 text-[12px] font-medium leading-[22px] tracking-[-0.156px] text-[#000]"
        )}
      >
        ©2025 Aroha Labs. All rights reserved.
      </span>
    </div>
  </div>
);

export default Footer;
