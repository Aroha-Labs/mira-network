package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

// Configuration variables
var (
	routerBaseURL = os.Getenv("ROUTER_BASE_URL")
	port          = os.Getenv("PORT")
	version       = os.Getenv("VERSION")
)

func init() {
	// Load environment variables from .env.local file
	if err := godotenv.Load(".env.local"); err != nil {
		log.Println("Warning: No .env.local file found or error loading it:", err)
	}

	// Now reload the environment variables after loading the .env file
	routerBaseURL = os.Getenv("ROUTER_BASE_URL")
	port = os.Getenv("PORT")
	version = os.Getenv("VERSION")

	fmt.Println("ROUTER_BASE_URL", routerBaseURL)
	fmt.Println("PORT", port)
	fmt.Println("VERSION", version)

	// Set default values if environment variables are not provided
	if port == "" {
		port = "8000"
	}
	if version == "" {
		version = "0.0.0"
	}

	// Note: Go 1.20+ automatically initializes the random seed,
	// so we don't need to call rand.Seed() anymore

	// Set up logging
	log.SetOutput(os.Stdout)
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}

func main() {
	r := setupRouter()

	// Create a server with graceful shutdown
	server := &http.Server{
		Addr:           "0.0.0.0:" + port, // Listen on all interfaces
		Handler:        r,
		ReadTimeout:    60 * time.Second,  // Increased from 30s
		WriteTimeout:   120 * time.Second, // Increased from 60s
		IdleTimeout:    240 * time.Second, // Increased from 120s
		MaxHeaderBytes: 1 << 20,           // 1MB max header size
	}

	// Set the maximum number of open files to handle more connections
	var rLimit syscall.Rlimit
	if err := syscall.Getrlimit(syscall.RLIMIT_NOFILE, &rLimit); err == nil {
		log.Printf("Current file limits: %d soft, %d hard", rLimit.Cur, rLimit.Max)
		// Attempt to increase the limit to the maximum allowed
		rLimit.Cur = rLimit.Max
		if err := syscall.Setrlimit(syscall.RLIMIT_NOFILE, &rLimit); err != nil {
			log.Printf("Warning: Failed to increase file limit: %v", err)
		} else {
			log.Printf("Increased file limit to: %d", rLimit.Cur)
		}
	}

	// Channel to signal server shutdown
	serverShutdown := make(chan struct{})

	// Start server in a goroutine
	go func() {
		log.Printf("Starting server on 0.0.0.0:%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not start server: %v", err)
		}
		close(serverShutdown)
	}()

	// Set up signal handling for graceful shutdown
	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, syscall.SIGINT, syscall.SIGTERM)
	<-signalCh

	log.Println("Shutting down server...")

	// Create a deadline context for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown the server
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server shutdown failed: %v", err)
	}

	// Wait for server to complete all in-flight requests
	<-serverShutdown

	log.Println("Server gracefully stopped")
}

func setupRouter() http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(120 * time.Second)) // Doubled timeout

	// Add connection throttling - limit to 1000 concurrent requests
	r.Use(middleware.ThrottleBacklog(1000, 200, 60*time.Second))

	// Compress responses
	r.Use(middleware.Compress(5))

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Routes
	r.Get("/health", healthCheckHandler)
	r.Get("/v1/models", listModelsHandler)
	r.Post("/v1/chat/completions", generateCompletionHandler)
	r.Post("/v1/verify", verifyHandler)
	r.Post("/v1/eval", evaluateHandler)

	return r
}

// healthCheckHandler handles health check requests
func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	response := HealthResponse{
		Status:  "ok",
		Version: version,
	}

	jsonResponse(w, response, http.StatusOK)
}

// listModelsHandler handles requests to list available models
func listModelsHandler(w http.ResponseWriter, r *http.Request) {
	// In a real implementation, this would load from a file or database
	// Here we're hardcoding for simplicity
	response := ModelListResponse{
		Object: "list",
		Data: []struct {
			ID     string `json:"id"`
			Object string `json:"object"`
		}{
			{ID: "openai/gpt-4o-mini", Object: "model"},
			{ID: "openai/gpt-4o", Object: "model"},
			{ID: "openrouter/anthropic/claude-3-haiku", Object: "model"},
			{ID: "anthropic/claude-3-sonnet", Object: "model"},
		},
	}

	jsonResponse(w, response, http.StatusOK)
}

// generateCompletionHandler handles requests for chat completions
func generateCompletionHandler(w http.ResponseWriter, r *http.Request) {
	var req AiRequest

	// Start a timeout context for the whole handler
	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	// Replace the request with the timeout context
	r = r.WithContext(ctx)

	// Use a recovery mechanism within this handler
	defer func() {
		if err := recover(); err != nil {
			log.Printf("Panic in generateCompletionHandler: %v", err)
			errorResponse(w, "Internal server error", http.StatusInternalServerError)
		}
	}()

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, "Invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validate request
	if len(req.Messages) == 0 {
		errorResponse(w, "At least one message is required", http.StatusBadRequest)
		return
	}

	hasUserMessage := false
	for _, msg := range req.Messages {
		if msg.Role == "user" {
			hasUserMessage = true
			break
		}
	}

	if !hasUserMessage {
		errorResponse(w, "At least one user message is required", http.StatusBadRequest)
		return
	}

	// Simulate processing delay - but use a shorter, more predictable delay (max 2 sec)
	delay := time.Duration(rand.Intn(1) + 1) // 1-2 seconds
	log.Printf("Request from %s, waiting for %d seconds", r.RemoteAddr, delay)

	// Use the context for the sleep to make it cancellable
	select {
	case <-time.After(delay * time.Second):
		// Continue processing
	case <-ctx.Done():
		log.Printf("Request cancelled during delay: %v", ctx.Err())
		errorResponse(w, "Request timeout", http.StatusRequestTimeout)
		return
	}

	// Check if the request was cancelled during our processing
	if ctx.Err() != nil {
		log.Printf("Context error: %v", ctx.Err())
		errorResponse(w, "Request timeout", http.StatusRequestTimeout)
		return
	}

	// Handle streaming or non-streaming response
	if req.Stream {
		handleStreamingResponse(w, r)
	} else {
		handleNonStreamingResponse(w, r)
	}
}

// handleStreamingResponse generates a streaming response
func handleStreamingResponse(w http.ResponseWriter, r *http.Request) {
	// Get the request context which has our timeout
	ctx := r.Context()

	// Set up SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Transfer-Encoding", "chunked")

	// Prepare to flush SSE responses in chunks
	flusher, ok := w.(http.Flusher)
	if !ok {
		errorResponse(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	// Create a mock response text and split into chunks
	responseText := "Hello! How can I assist you today?"
	chunks := splitText(responseText, 5)

	// Send initial SSE response with assistant role
	responseID := fmt.Sprintf("chatcmpl-%d", time.Now().Unix())

	initialChunk := StreamChunk{
		ID:      responseID,
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   "openai/gpt-4o-mini",
		Choices: []struct {
			Index int `json:"index"`
			Delta struct {
				Role    string `json:"role,omitempty"`
				Content string `json:"content,omitempty"`
			} `json:"delta"`
			FinishReason string `json:"finish_reason,omitempty"`
		}{
			{
				Index: 0,
				Delta: struct {
					Role    string `json:"role,omitempty"`
					Content string `json:"content,omitempty"`
				}{
					Role: "assistant",
				},
			},
		},
	}

	// Send the initial chunk with role
	if err := sendSSEChunk(w, initialChunk); err != nil {
		log.Printf("Error sending initial chunk: %v", err)
		return
	}
	flusher.Flush()

	// Small delay before starting content, but respect the context timeout
	select {
	case <-time.After(50 * time.Millisecond): // Reduced from 100ms
	case <-ctx.Done():
		log.Printf("Request cancelled during initial delay: %v", ctx.Err())
		return
	}

	// Send each content chunk
	for i, chunk := range chunks {
		// Check if the request has been cancelled
		if ctx.Err() != nil {
			log.Printf("Context cancelled during streaming: %v", ctx.Err())
			return
		}

		contentChunk := StreamChunk{
			ID:      responseID,
			Object:  "chat.completion.chunk",
			Created: time.Now().Unix(),
			Model:   "openai/gpt-4o-mini",
			Choices: []struct {
				Index int `json:"index"`
				Delta struct {
					Role    string `json:"role,omitempty"`
					Content string `json:"content,omitempty"`
				} `json:"delta"`
				FinishReason string `json:"finish_reason,omitempty"`
			}{
				{
					Index: 0,
					Delta: struct {
						Role    string `json:"role,omitempty"`
						Content string `json:"content,omitempty"`
					}{
						Content: chunk,
					},
				},
			},
		}

		if err := sendSSEChunk(w, contentChunk); err != nil {
			log.Printf("Error sending content chunk %d: %v", i, err)
			return
		}
		flusher.Flush()

		// Shorter delay between chunks
		select {
		case <-time.After(50 * time.Millisecond): // Reduced from 100ms
		case <-ctx.Done():
			log.Printf("Request cancelled during chunk delay: %v", ctx.Err())
			return
		}
	}

	// Check if the request has been cancelled before sending final chunk
	if ctx.Err() != nil {
		log.Printf("Context cancelled before final chunk: %v", ctx.Err())
		return
	}

	// Send final chunk with finish reason
	finalChunk := StreamChunk{
		ID:      responseID,
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   "openai/gpt-4o-mini",
		Choices: []struct {
			Index int `json:"index"`
			Delta struct {
				Role    string `json:"role,omitempty"`
				Content string `json:"content,omitempty"`
			} `json:"delta"`
			FinishReason string `json:"finish_reason,omitempty"`
		}{
			{
				Index: 0,
				Delta: struct {
					Role    string `json:"role,omitempty"`
					Content string `json:"content,omitempty"`
				}{},
				FinishReason: "stop",
			},
		},
	}

	if err := sendSSEChunk(w, finalChunk); err != nil {
		log.Printf("Error sending final chunk: %v", err)
		return
	}
	flusher.Flush()

	// End the stream
	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}

// sendSSEChunk sends a single SSE chunk
func sendSSEChunk(w http.ResponseWriter, chunk interface{}) error {
	data, err := json.Marshal(chunk)
	if err != nil {
		log.Printf("Error marshaling SSE chunk: %v", err)
		return err
	}

	_, err = fmt.Fprintf(w, "data: %s\n\n", data)
	return err
}

// handleNonStreamingResponse generates a non-streaming response
func handleNonStreamingResponse(w http.ResponseWriter, r *http.Request) {
	// Get the request context
	ctx := r.Context()

	// Check if the request has been cancelled
	if ctx.Err() != nil {
		log.Printf("Context cancelled before generating response: %v", ctx.Err())
		return
	}

	responseText := "Hello! How can I assist you today?"

	response := CompletionResponse{
		ID:                fmt.Sprintf("chatcmpl-%d", time.Now().Unix()),
		Object:            "chat.completion",
		Created:           time.Now().Unix(),
		Model:             "openai/gpt-4o-mini",
		SystemFingerprint: "fp_" + strconv.FormatInt(time.Now().UnixNano()%100000000, 16),
		Choices: []CompletionChoice{
			{
				Index:        0,
				FinishReason: "stop",
				Message: Message{
					Role:    "assistant",
					Content: responseText,
				},
			},
		},
		Usage: CompletionUsage{
			PromptTokens:     30,
			CompletionTokens: 10,
			TotalTokens:      40,
		},
	}

	// Log the response for debugging
	log.Printf("Sending non-streaming response to %s", r.RemoteAddr)

	// Check again if the context was cancelled while preparing the response
	if ctx.Err() != nil {
		log.Printf("Context cancelled after preparing response: %v", ctx.Err())
		return
	}

	jsonResponse(w, response, http.StatusOK)
}

// verifyHandler handles verification requests
func verifyHandler(w http.ResponseWriter, r *http.Request) {
	// In a real implementation, this would perform actual verification
	// Here we're mocking a response
	response := map[string]interface{}{
		"result":  "yes",
		"content": "The statement appears to be correct based on the available information.",
	}

	jsonResponse(w, response, http.StatusOK)
}

// evaluateHandler handles model evaluation requests
func evaluateHandler(w http.ResponseWriter, r *http.Request) {
	// For now, we'll return a simplified mock result
	// In a real implementation, this would process CSV data and evaluate models
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "prompt,openai/gpt-4\nExample prompt,9.5\nAnother example,8.7\n")
}

// Helper functions

// splitText splits a text into chunks of specified size
func splitText(text string, chunkSize int) []string {
	var chunks []string

	for i := 0; i < len(text); i += chunkSize {
		end := i + chunkSize
		if end > len(text) {
			end = len(text)
		}
		chunks = append(chunks, text[i:end])
	}

	return chunks
}

// jsonResponse sends a JSON response with the specified status code
func jsonResponse(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}

// errorResponse sends an error response with the specified message and status code
func errorResponse(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := map[string]string{
		"error": message,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding error response: %v", err)
	}
}
