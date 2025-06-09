import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';


export const adminAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    throw new HTTPException(500, { message: 'Admin API key not configured' });
  }

  if (!authHeader) {
    throw new HTTPException(401, { 
      message: 'Authorization header required'
    });
  }

  const [scheme, key] = authHeader.split(' ');
  
  if (!key || (scheme !== 'Bearer' && scheme !== 'ApiKey')) {
    throw new HTTPException(401, { 
      message: 'Invalid authorization format. Use "Bearer <key>" or "ApiKey <key>"'
    });
  }

  if (key !== expectedKey) {
    throw new HTTPException(401, { 
      message: 'Invalid API key'
    });
  }

  await next();
});


export const optionalAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (authHeader && expectedKey) {
    const [scheme, key] = authHeader.split(' ');
    if (key && (scheme === 'Bearer' || scheme === 'ApiKey') && key === expectedKey) {
      c.set('isAdmin', true);
    }
  }

  await next();
});