import { createWalletClient, custom, verifyMessage } from 'viem';
import { mainnet } from 'viem/chains';
import WalletConnect from '@walletconnect/client';
import QRCodeModal from '@walletconnect/qrcode-modal';

// Create WalletConnect connector
const connector = new WalletConnect({
  bridge: 'https://bridge.walletconnect.org',
  qrcodeModal: QRCodeModal,
});

export const connectWallet = async () => {
  if (!connector.connected) {
    // Create new session
    await connector.createSession();
  }

  // Subscribe to connection events
  return new Promise((resolve, reject) => {
    connector.on('connect', (error, payload) => {
      if (error) {
        reject(error);
      }

      const { accounts } = payload.params[0];
      resolve(accounts[0]);
    });

    connector.on('error', (error) => {
      reject(error);
    });
  });
};

export const signMessage = async (address: string): Promise<string> => {
  if (!connector.connected) {
    throw new Error('No wallet connected');
  }

  const message = `Login to App with wallet ${address}`;
  
  // Sign message using WalletConnect
  const signature = await connector.signPersonalMessage([message, address]);
  
  return signature;
};

// Optional: Add disconnect method
export const disconnectWallet = async () => {
  if (connector.connected) {
    await connector.killSession();
  }
}; 
