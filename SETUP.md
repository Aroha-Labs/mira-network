# **Mira Client Setup Guide**

This guide walks you through the steps required to set up and manage `mira-client` on your Linux system.

---

## **Prerequisites**

1. A Linux-based system (Ubuntu recommended).
2. Basic familiarity with terminal commands.
3. Sudo access.
4. Required API keys:

   - `OPENAI_API_KEY`
   - `OPENROUTER_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `MIRA_API_KEY`

   _If you do not have these keys, request them by emailing:_

   ```
   mira-api-key-request@alts.dev
   ```

   **Subject**: `LLM keys request for Mira client`

---

## **Step 1: Update Your System**

Ensure your system is up-to-date:

```bash
sudo apt update
sudo apt upgrade
sudo reboot
```

---

## **Step 2: Install Required Dependencies**

Install dependencies for networking and Docker:

```bash
sudo apt-get install ca-certificates curl
```

---

## **Step 3: Install and Configure ZeroTier**

1. Install ZeroTier:
   ```bash
   curl -s https://install.zerotier.com | sudo bash
   ```
2. Join the ZeroTier network:
   ```bash
   sudo zerotier-cli join 12ac4a1e716ea031
   ```
3. Verify the network connection:
   ```bash
   sudo zerotier-cli listnetworks
   ```

---

## **Step 4: Install Docker**

1. Add the Docker repository:
   ```bash
   sudo install -m 0755 -d /etc/apt/keyrings
   sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   sudo chmod a+r /etc/apt/keyrings/docker.asc
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt-get update
   ```
2. Install Docker:
   ```bash
   sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```
3. Add your user to the Docker group:
   ```bash
   sudo groupadd docker
   sudo usermod -aG docker $USER
   ```
4. Verify Docker installation:
   ```bash
   docker ps
   ```

---

## **Step 5: Set Up Mira Client**

1. Create a directory for `mira-client`:
   ```bash
   mkdir mira-client
   cd mira-client/
   ```
2. Download the `mira-client` binary and make it executable:
   ```bash
   chmod +x mira-client-linux-v0.0.0
   ```

---

## **Step 6: Configure Mira Client**

1. **Create the required directory structure:**
   ```bash
   mkdir -p /home/ubuntu/.mira-client/litellm
   ```
2. **Create the necessary configuration files:**
   ```bash
   touch /home/ubuntu/.mira-client/litellm/.env
   touch /home/ubuntu/.mira-client/litellm/config.yml
   touch /home/ubuntu/.mira-client/.env.llmkeys
   ```
3. **Add API keys to the `.env.llmkeys` file:**

   Open the file in a text editor and add the following content:

   ```
   OPENAI_API_KEY=<your_openai_api_key>
   OPENROUTER_API_KEY=<your_openrouter_api_key>
   ANTHROPIC_API_KEY=<your_anthropic_api_key>
   MIRA_API_KEY=<your_mira_api_key>
   ```

   Replace `<your_*_api_key>` with your actual keys.

---

## **Step 7: Use Mira Client**

1. **View available commands:**
   ```bash
   ./mira-client-linux-v0.0.0 --help
   ```
2. **Join the ZeroTier network:**
   ```bash
   ./mira-client-linux-v0.0.0 join-network
   ```
3. **Register the client:**
   ```bash
   sudo ./mira-client-linux-v0.0.0 register-client
   ```

---

## **Step 8: Manage Mira Client Services**

Use the `service` command to manage `mira-client` services.

1. **Start Services:**
   ```bash
   ./mira-client-linux-v0.0.0 service start
   ```
2. **Stop Services:**
   ```bash
   ./mira-client-linux-v0.0.0 service stop
   ```
3. **Remove Services:**
   ```bash
   ./mira-client-linux-v0.0.0 service remove
   ```

---

## **Verification and Troubleshooting**

- **Check running Docker containers:**
  ```bash
  docker ps
  ```
- **Verify ZeroTier network:**
  ```bash
  sudo zerotier-cli listnetworks
  ```
- **Get help for any command:**
  ```bash
  ./mira-client-linux-v0.0.0 [command] --help
  ```
