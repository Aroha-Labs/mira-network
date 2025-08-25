package utils

import (
	"Aroha-Labs/mira-client/constants"
	"fmt"
	"os"
	"strings"
)

// GetStoredRouterURL retrieves the stored router URL
func GetStoredRouterURL() (string, error) {
	routerFile := GetConfigFilePath(constants.ROUTER_URL_CONFIG_FILE)
	
	content, err := os.ReadFile(routerFile)
	if err != nil {
		if os.IsNotExist(err) {
			return constants.DEFAULT_ROUTER_URL, nil // Return default if not stored
		}
		return "", fmt.Errorf("failed to read router URL file: %w", err)
	}
	
	url := strings.TrimSpace(string(content))
	if url == "" {
		return constants.DEFAULT_ROUTER_URL, nil
	}
	return url, nil
}

// SaveRouterURL stores the router URL
func SaveRouterURL(url string) error {
	if url == "" {
		return fmt.Errorf("cannot save empty router URL")
	}
	
	routerFile := GetConfigFilePath(constants.ROUTER_URL_CONFIG_FILE)
	
	// Ensure config directory exists
	configDir := GetConfigFilePath("")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}
	
	// Write URL with restricted permissions (readable only by owner)
	if err := os.WriteFile(routerFile, []byte(url), 0600); err != nil {
		return fmt.Errorf("failed to write router URL file: %w", err)
	}
	
	return nil
}

// DeleteRouterURL removes the stored router URL
func DeleteRouterURL() error {
	routerFile := GetConfigFilePath(constants.ROUTER_URL_CONFIG_FILE)
	
	if err := os.Remove(routerFile); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete router URL file: %w", err)
	}
	
	return nil
}