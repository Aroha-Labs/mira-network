package utils

import (
	"Aroha-Labs/mira-client/constants"
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