import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import Button from "@/components/ui/Button";
import Typography from "@/components/ui/Typography";
import { useAuth } from "@/hooks/useAuth";
import { useWeb3Modal } from "@web3modal/wagmi-react-native";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit-wagmi-react-native";

interface WalletAuthProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function WalletAuth({ isLoading, setIsLoading }: WalletAuthProps) {
  const [error, setError] = useState<string | null>(null);
  const { walletLogin } = useAuth();
  const { open } = useAppKit()
  const { address, isConnecting } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const handleWalletConnect = async () => {
    setIsLoading(true);
    console.log("handleWalletConnect");
    console.log(address);
    try {
      setError(null);

      if (!address) {
        await open();
        return;
      }
      console.log("address:", address);
      // Sign message to verify ownership
      const message = `Login to Mira Network with wallet ${address}`;
      const signature = await signMessageAsync({ message });

      console.log("signature:", signature);

      walletLogin({ address, signature });
    } catch (err) {
      console.error("Wallet connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button
        title={
          isLoading
            ? "Connecting..."
            : address
            ? "Sign Message"
            : "Connect Wallet"
        }
        onPress={handleWalletConnect}
        disabled={isLoading}
        style={styles.button}
      />

      {error && (
        <Typography variant="caption" style={styles.errorText}>
          {error}
        </Typography>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginVertical: 8,
  },
  button: {
    backgroundColor: "#4F46E5",
  },
  errorText: {
    color: "#dc2626",
    textAlign: "center",
    marginTop: 8,
  },
});
