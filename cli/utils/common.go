package utils

import (
	"fmt"
	"os"
	"path/filepath"
)

func GetConfigFilePath(fileName string) string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Println("Error getting home directory:", err)
		os.Exit(1)
	}
	return filepath.Join(homeDir, ".mira-client", fileName)
}
