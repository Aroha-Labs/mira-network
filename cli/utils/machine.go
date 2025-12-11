package utils

import (
	"Aroha-Labs/mira-client/constants"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
)

// GetMachineID retrieves or generates a machine ID
func GetMachineID() (string, error) {
	configFilePath := GetConfigFilePath(constants.MACHINE_ID_CONFIG_FILE)
	content, err := os.ReadFile(configFilePath)
	if err != nil || strings.TrimSpace(string(content)) == "" {
		// Generate a new UUID if the file doesn't exist or is empty
		newUUID := uuid.New().String()
		if err := os.WriteFile(configFilePath, []byte(newUUID), 0644); err != nil {
			return "", fmt.Errorf("failed to write new machine ID to config file: %w", err)
		}
		return newUUID, nil
	}
	return strings.TrimSpace(string(content)), nil
}