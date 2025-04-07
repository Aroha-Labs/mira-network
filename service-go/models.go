package main

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Function represents a function definition for function calling
type Function struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// Tool represents a tool that can be used by the model
type Tool struct {
	Type     string   `json:"type"`
	Function Function `json:"function"`
}

// ToolCall represents a function call made by the model
type ToolCall struct {
	ID       string   `json:"id"`
	Type     string   `json:"type"`
	Function Function `json:"function"`
	Index    int      `json:"index,omitempty"`
}

// ModelProvider represents a provider of language models
type ModelProvider struct {
	BaseURL      string `json:"base_url"`
	APIKey       string `json:"api_key"`
	ProviderName string `json:"provider_name"`
}

// AiRequest represents a request to generate a completion
type AiRequest struct {
	Model         string         `json:"model"`
	ModelProvider *ModelProvider `json:"model_provider,omitempty"`
	Messages      []Message      `json:"messages"`
	Stream        bool           `json:"stream"`
	Tools         []Tool         `json:"tools,omitempty"`
	ToolChoice    string         `json:"tool_choice,omitempty"`
}

// CompletionChoice represents a choice in a completion response
type CompletionChoice struct {
	Index        int        `json:"index"`
	Message      Message    `json:"message"`
	FinishReason string     `json:"finish_reason"`
	Logprobs     *string    `json:"logprobs"`
	ToolCalls    []ToolCall `json:"tool_calls,omitempty"`
}

// CompletionUsage represents token usage in a completion response
type CompletionUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// CompletionResponse represents a response from a completion request
type CompletionResponse struct {
	ID                string             `json:"id"`
	Object            string             `json:"object"`
	Created           int64              `json:"created"`
	Model             string             `json:"model"`
	SystemFingerprint string             `json:"system_fingerprint,omitempty"`
	Choices           []CompletionChoice `json:"choices"`
	Usage             CompletionUsage    `json:"usage"`
}

// StreamChunk represents a chunk in a streaming response
type StreamChunk struct {
	ID                string `json:"id"`
	Object            string `json:"object"`
	Created           int64  `json:"created"`
	Model             string `json:"model"`
	SystemFingerprint string `json:"system_fingerprint,omitempty"`
	Choices           []struct {
		Index int `json:"index"`
		Delta struct {
			Role    string `json:"role,omitempty"`
			Content string `json:"content,omitempty"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason,omitempty"`
	} `json:"choices"`
}

// ModelListResponse represents a response listing available models
type ModelListResponse struct {
	Object string `json:"object"`
	Data   []struct {
		ID     string `json:"id"`
		Object string `json:"object"`
	} `json:"data"`
}

// HealthResponse represents a health check response
type HealthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}
