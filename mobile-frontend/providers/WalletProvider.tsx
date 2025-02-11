import "@walletconnect/react-native-compat";
import { WagmiProvider } from "wagmi";
import { mainnet, polygon, arbitrum } from "@wagmi/core/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createAppKit,
  defaultWagmiConfig,
  AppKit,
} from "@reown/appkit-wagmi-react-native";

// 1. Get projectId at https://cloud.reown.com
const projectId = process.env.EXPO_PUBLIC_WALLET_CONNECT_PROJECT_ID;

// 2. Create config
const metadata = {
  name: "Mira Chat",
  description: "Mira Chat",
  url: "https://console.mira.network",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
  redirect: {
    native: "mirachat://",
    universal: "https://console.mira.network",
  },
};

const chains = [mainnet, polygon, arbitrum] as const;

const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId: projectId as string,
  metadata,
});

// 3. Create modal
createAppKit({
  projectId: projectId as string,
  wagmiConfig,
  defaultChain: mainnet, // Optional
  enableAnalytics: true, // Optional - defaults to your Cloud configuration
});

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      {children}
      <AppKit />
    </WagmiProvider>
  );
}
