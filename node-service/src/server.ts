import Fastify from 'fastify';
import app from './app';

const fastify = Fastify({
  logger: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    transport: process.env.NODE_ENV === 'development' 
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
          }
        }
      : undefined
  }
});

// Register the app
fastify.register(app);

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await fastify.close();
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  });
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '34523', 10);
    const host = '0.0.0.0';
    
    await fastify.listen({ port, host });
    fastify.log.info(`Server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();