package utils

import (
	"Aroha-Labs/mira-client/constants"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
)

// GetStoredToken retrieves the stored authentication token
func GetStoredToken() (string, error) {
	tokenFile := GetConfigFilePath(constants.MACHINE_TOKEN_CONFIG_FILE)
	
	content, err := os.ReadFile(tokenFile)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil // No token stored yet
		}
		return "", fmt.Errorf("failed to read token file: %w", err)
	}
	
	token := strings.TrimSpace(string(content))
	return token, nil
}

// SaveToken stores the authentication token
func SaveToken(token string) error {
	if token == "" {
		return fmt.Errorf("cannot save empty token")
	}
	
	tokenFile := GetConfigFilePath(constants.MACHINE_TOKEN_CONFIG_FILE)
	
	// Ensure config directory exists
	configDir := GetConfigFilePath("")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}
	
	// Write token with restricted permissions (readable only by owner)
	if err := os.WriteFile(tokenFile, []byte(token), 0600); err != nil {
		return fmt.Errorf("failed to write token file: %w", err)
	}
	
	return nil
}

// DeleteToken removes the stored token
func DeleteToken() error {
	tokenFile := GetConfigFilePath(constants.MACHINE_TOKEN_CONFIG_FILE)
	
	if err := os.Remove(tokenFile); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete token file: %w", err)
	}
	
	return nil
}

// TokenExists checks if a token is already stored
func TokenExists() bool {
	token, _ := GetStoredToken()
	return token != ""
}

// GenerateAccessToken generates a secure random token for service access
func GenerateAccessToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// SaveServiceAccessToken saves the service access token
func SaveServiceAccessToken(token string) error {
	if token == "" {
		return fmt.Errorf("cannot save empty token")
	}
	
	tokenFile := GetConfigFilePath(".service_access_token")
	
	// Ensure config directory exists
	configDir := GetConfigFilePath("")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}
	
	// Write token with restricted permissions (readable only by owner)
	if err := os.WriteFile(tokenFile, []byte(token), 0600); err != nil {
		return fmt.Errorf("failed to write service access token file: %w", err)
	}
	
	return nil
}

// GetServiceAccessToken retrieves the stored service access token
func GetServiceAccessToken() (string, error) {
	tokenFile := GetConfigFilePath(".service_access_token")
	
	content, err := os.ReadFile(tokenFile)
	if err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("no service access token found")
		}
		return "", fmt.Errorf("failed to read service access token file: %w", err)
	}
	
	return strings.TrimSpace(string(content)), nil
}