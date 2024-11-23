package cmds

import (
	"Aroha-Labs/mira-client/constants"
	"Aroha-Labs/mira-client/utils"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"github.com/cqroot/prompt"
	"github.com/spf13/cobra"
)

type SystemPrompt struct {
	ID           int    `json:"id"`
	SystemPrompt string `json:"system_prompt"`
}

func ReadSystemPrompts() ([]SystemPrompt, error) {
	filePath := utils.GetConfigFilePath(constants.SYSTEM_PROMPT_FILE)
	file, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			// Create the directory if it doesn't exist
			dir := filepath.Dir(filePath)
			if err := os.MkdirAll(dir, 0755); err != nil {
				return nil, err
			}
			// Create an empty file
			if err := os.WriteFile(filePath, []byte("[]"), 0644); err != nil {
				return nil, err
			}
			return []SystemPrompt{}, nil
		}
		return nil, err
	}

	var prompts []SystemPrompt
	if err := json.Unmarshal(file, &prompts); err != nil {
		return nil, err
	}
	return prompts, nil
}

func writeSystemPrompts(prompts []SystemPrompt) error {
	filePath := utils.GetConfigFilePath(constants.SYSTEM_PROMPT_FILE)
	data, err := json.MarshalIndent(prompts, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List all system prompts",
	RunE: func(cmd *cobra.Command, args []string) error {
		prompts, err := ReadSystemPrompts()
		if err != nil {
			return err
		}
		for _, prompt := range prompts {
			fmt.Printf("ID: %d, Prompt: %s\n", prompt.ID, prompt.SystemPrompt)
		}
		return nil
	},
}

var createCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new system prompt",
	RunE: func(cmd *cobra.Command, args []string) error {
		var newPrompt string
		if len(args) < 1 {
			p := prompt.New()
			var err error
			newPrompt, err = p.Input("Enter the system prompt: ")
			if err != nil {
				return fmt.Errorf("error reading input: %v", err)
			}
		} else {
			newPrompt = args[0]
		}

		prompts, err := ReadSystemPrompts()
		if err != nil {
			return err
		}

		newID := 1
		if len(prompts) > 0 {
			newID = prompts[len(prompts)-1].ID + 1
		}

		prompts = append(prompts, SystemPrompt{ID: newID, SystemPrompt: newPrompt})
		return writeSystemPrompts(prompts)
	},
}

var deleteCmd = &cobra.Command{
	Use:   "delete",
	Short: "Delete a system prompt by ID",
	RunE: func(cmd *cobra.Command, args []string) error {
		var id int
		var err error
		if len(args) < 1 {
			p := prompt.New()
			idStr, err := p.Input("Enter the ID to delete: ")
			if err != nil {
				return fmt.Errorf("error reading input: %v", err)
			}
			id, err = strconv.Atoi(idStr)
			if err != nil {
				return fmt.Errorf("invalid ID")
			}
		} else {
			id, err = strconv.Atoi(args[0])
			if err != nil {
				return fmt.Errorf("invalid ID")
			}
		}

		prompts, err := ReadSystemPrompts()
		if err != nil {
			return err
		}

		for i, prompt := range prompts {
			if prompt.ID == id {
				prompts = append(prompts[:i], prompts[i+1:]...)
				return writeSystemPrompts(prompts)
			}
		}
		return fmt.Errorf("prompt with ID %d not found", id)
	},
}

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update a system prompt by ID",
	RunE: func(cmd *cobra.Command, args []string) error {
		var id int
		var newPrompt string
		var err error

		if len(args) < 1 {
			p := prompt.New()
			idStr, err := p.Input("Enter the ID to update: ")
			if err != nil {
				return fmt.Errorf("error reading input: %v", err)
			}
			id, err = strconv.Atoi(idStr)
			if err != nil {
				return fmt.Errorf("invalid ID")
			}
		} else {
			id, err = strconv.Atoi(args[0])
			if err != nil {
				return fmt.Errorf("invalid ID")
			}
		}

		if len(args) < 2 {
			p := prompt.New()
			newPrompt, err = p.Input("Enter the new system prompt: ")
			if err != nil {
				return fmt.Errorf("error reading input: %v", err)
			}
		} else {
			newPrompt = args[1]
		}

		prompts, err := ReadSystemPrompts()
		if err != nil {
			return err
		}

		for i, prompt := range prompts {
			if prompt.ID == id {
				prompts[i].SystemPrompt = newPrompt
				return writeSystemPrompts(prompts)
			}
		}
		return fmt.Errorf("prompt with ID %d not found", id)
	},
}

var SystemPromptCmd = &cobra.Command{
	Use:   "system-prompt",
	Short: "Manage system prompts",
}

func init() {
	SystemPromptCmd.AddCommand(listCmd)
	SystemPromptCmd.AddCommand(createCmd)
	SystemPromptCmd.AddCommand(deleteCmd)
	SystemPromptCmd.AddCommand(updateCmd)
}
