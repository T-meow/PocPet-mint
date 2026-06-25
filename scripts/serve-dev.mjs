import { createServer } from 'vite';

const getArgValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
};

const port = Number(getArgValue('--port', process.env.PORT ?? 5173));

const server = await createServer({
  server: {
    host: '127.0.0.1',
    port,
    strictPort: false,
  },
});

await server.listen();
server.printUrls();

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

