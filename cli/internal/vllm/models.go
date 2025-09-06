package vllm

// Model represents a VLLM-compatible model
type Model struct {
	Name        string // Full model name for VLLM
	DisplayName string // User-friendly name
	VRAMNeeded  string // Estimated VRAM requirement
	Speed       string // Relative speed indicator
	MaxTokens   int    // Max context length
	RequiresHF  bool   // Whether HuggingFace token is required
}

// PopularModels is a curated list of well-tested models
var PopularModels = []Model{
	{
		Name:        "Qwen/Qwen2-1.5B-Instruct",
		DisplayName: "Qwen2 1.5B (Recommended)",
		VRAMNeeded:  "4GB",
		Speed:       "Fast",
		MaxTokens:   32768,
		RequiresHF:  false,
	},
	{
		Name:        "Qwen/Qwen2-7B-Instruct",
		DisplayName: "Qwen2 7B",
		VRAMNeeded:  "16GB",
		Speed:       "Medium",
		MaxTokens:   32768,
		RequiresHF:  false,
	},
	{
		Name:        "mistralai/Mistral-7B-Instruct-v0.3",
		DisplayName: "Mistral 7B v0.3",
		VRAMNeeded:  "16GB",
		Speed:       "Medium",
		MaxTokens:   32768,
		RequiresHF:  false,
	},
	{
		Name:        "meta-llama/Llama-3.2-3B-Instruct",
		DisplayName: "Llama 3.2 3B",
		VRAMNeeded:  "8GB",
		Speed:       "Fast",
		MaxTokens:   8192,
		RequiresHF:  true, // Requires HF token
	},
	{
		Name:        "meta-llama/Llama-3.1-8B-Instruct",
		DisplayName: "Llama 3.1 8B",
		VRAMNeeded:  "16GB",
		Speed:       "Medium",
		MaxTokens:   131072,
		RequiresHF:  true, // Requires HF token
	},
	{
		Name:        "google/gemma-2-2b-it",
		DisplayName: "Gemma 2 2B",
		VRAMNeeded:  "6GB",
		Speed:       "Fast",
		MaxTokens:   8192,
		RequiresHF:  false,
	},
	{
		Name:        "microsoft/Phi-3.5-mini-instruct",
		DisplayName: "Phi 3.5 Mini",
		VRAMNeeded:  "8GB",
		Speed:       "Fast",
		MaxTokens:   131072,
		RequiresHF:  false,
	},
}

// GetModelByName returns a model by its name
func GetModelByName(name string) *Model {
	for _, model := range PopularModels {
		if model.Name == name {
			return &model
		}
	}
	return nil
}

// GetModelByDisplayName returns a model by its display name
func GetModelByDisplayName(displayName string) *Model {
	for _, model := range PopularModels {
		if model.DisplayName == displayName {
			return &model
		}
	}
	return nil
}