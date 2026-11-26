import { createUniteServer } from './app.js';

async function main() {
  const server = await createUniteServer();
  await server.listen();

  const shutdown = async (signal: string) => {
    server.logger.info({ signal }, 'Shutting down Unite server');
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start Unite server:', err);
  process.exit(1);
});

