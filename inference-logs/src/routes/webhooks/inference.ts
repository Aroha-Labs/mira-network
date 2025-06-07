import { FastifyPluginAsync } from "fastify";
import { InferenceLog } from "../../constants";
import { submitBatchInferenceLogs, submitInferenceLog } from "../../services/blockchain";

// Define request body schema
interface WebhookBody {
    logs: InferenceLog[];
}

const inferenceWebhook: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.post<{ Body: WebhookBody }>("/", {
        schema: {
            body: {
                type: "object",
                required: ["logs"],
                properties: {
                    logs: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["walletAddress", "logId"],
                            properties: {
                                walletAddress: { type: "string" },
                                logId: { type: "string" },
                                "@timestamp": { type: "string" },
                            },
                        },
                    },
                },
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        message: { type: "string" },
                        txHash: { type: "string" },
                        processedLogs: { type: "number" },
                    },
                },
            },
        },
        bodyLimit: 10 * 1024 * 1024, // Set limit to 10MB
        handler: async (request, reply) => {
            try {
                // Log if request was compressed
                const contentEncoding = request.headers['content-encoding'];
                if (contentEncoding) {
                    fastify.log.info(`Received compressed request with encoding: ${contentEncoding}`);
                }

                const { logs } = request.body;

                if (!logs || logs.length === 0) {
                    return reply.code(400).send({
                        success: false,
                        message: "No logs provided",
                    });
                }

                fastify.log.info(`Received ${logs.length} inference logs`);

                // If only one log, use single submission
                if (logs.length === 1) {
                    const txHash = await submitInferenceLog(logs[0]);
                    return {
                        success: true,
                        message: "Log submitted to blockchain",
                        txHash,
                        processedLogs: 1,
                    };
                }

                // For multiple logs, use batch submission
                const txHash = await submitBatchInferenceLogs(logs);
                return {
                    success: true,
                    message: "Logs batch submitted to blockchain",
                    txHash,
                    processedLogs: logs.length,
                };
            } catch (error) {
                fastify.log.error(error);
                return reply.code(500).send({
                    success: false,
                    message: "Failed to process logs",
                    error: (error as Error).message,
                });
            }
        },
    });

    // Health check endpoint
    fastify.get("/health", async () => {
        return { status: "ok" };
    });
};

export default inferenceWebhook; 