import fp from "fastify-plugin";
import swagger, { SwaggerOptions } from "@fastify/swagger";
import swaggerUi, { FastifySwaggerUiOptions } from "@fastify/swagger-ui";

export default fp<SwaggerOptions | FastifySwaggerUiOptions>(async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "Mira Node Service",
        description: "Mira Node Service API",
        version: process.env.VERSION || "0.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      persistAuthorization: true,
    },
  });
});
