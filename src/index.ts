import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { serve } from '@hono/node-server';
import { merkleRouter } from './routes/merkle';

const app = new OpenAPIHono();

app.get('/health', (c) => c.json({ status: 'OK', timestamp: new Date().toISOString() }));

app.route('/api/v1', merkleRouter);

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Merkle Rewards Distributor API',
    description: 'Backend API for managing Merkle tree-based rewards distribution'
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'API key authentication. Use format: "Bearer YOUR_API_KEY" or "ApiKey YOUR_API_KEY"'
      }
    }
  }
});

app.get('/swagger', swaggerUI({ url: '/doc' }));

app.get('/', (c) => {
  return c.json({
    message: 'Merkle Rewards Distributor API',
    version: '1.0.0',
    docs: '/swagger',
    health: '/health',
    note: 'Admin endpoints require API key authentication'
  });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`🚀 Server is running on http://localhost:${port}`);
console.log(`📚 API Documentation: http://localhost:${port}/swagger`);

serve({
  fetch: app.fetch,
  port
});