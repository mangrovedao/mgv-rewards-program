import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { MerkleService } from '../services/merkleService';
import { adminAuth, optionalAuth } from '../middleware/auth'; // Adjust path as needed

const RewardDataSchema = z.object({
  account: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer string')
});


const ClaimProofSchema = z.object({
  account: z.string(),
  token: z.string(),
  amount: z.string(),
  proof: z.array(z.string())
});

const MerkleRootSchema = z.object({
  id: z.string(),
  root: z.string(),
  ipfsHash: z.string().nullable(),
  totalRewards: z.record(z.string()),
  recipientCount: z.number(),
  status: z.string(),
  submittedAt: z.string().nullable(),
  validAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const merkleRouter = new OpenAPIHono();
const merkleService = new MerkleService();

// 📖 PUBLIC - Get claim proof (users need this to claim rewards)
merkleRouter.openapi(
  createRoute({
    method: 'get',
    path: '/merkle/proof/{account}/{token}',
    tags: ['Merkle Trees'],
    summary: 'Get claim proof for account and token',
    request: {
      param: z.object({
        account: z.string(),
        token: z.string()
      }),
      query: z.object({
        rootId: z.string().optional()
      })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: ClaimProofSchema
          }
        },
        description: 'Claim proof data'
      },
      404: {
        description: 'No proof found'
      }
    }
  }),
  async (c) => {
    const { account, token } = c.req.valid('param');
    const { rootId } = c.req.valid('query');
    
    const proof = await merkleService.getProof(account, token, rootId);
    
    if (!proof) {
      return c.json({ error: 'No proof found for this account and token' }, 404);
    }

    return c.json(proof);
  }
);

// 📖 PUBLIC - Get all proofs for account (users need this)
merkleRouter.openapi(
  createRoute({
    method: 'get',
    path: '/merkle/proofs/{account}',
    tags: ['Merkle Trees'],
    summary: 'Get all claim proofs for an account',
    request: {
      param: z.object({
        account: z.string()
      }),
      query: z.object({
        rootId: z.string().optional()
      })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.array(ClaimProofSchema)
          }
        },
        description: 'Array of claim proofs'
      }
    }
  }),
  async (c) => {
    console.log(c)
    const { account } = c.req.valid('param');
    const { rootId } = c.req.valid('query');
    
    const proofs = await merkleService.getAccountProofs(account, rootId);
    return c.json(proofs);
  }
);

// 🔓 OPTIONAL AUTH - List roots (public info but admin gets more details)
merkleRouter.openapi(
  createRoute({
    method: 'get',
    path: '/merkle/roots',
    tags: ['Merkle Trees'],
    summary: 'List all Merkle roots',
    request: {
      query: z.object({
        limit: z.string().optional().default('50'),
        offset: z.string().optional().default('0')
      })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.array(MerkleRootSchema)
          }
        },
        description: 'List of Merkle roots'
      }
    }
  }),
  optionalAuth, // Use optional auth
  async (c) => {
    const query = c.req.valid('query');
    const limit = parseInt(query.limit);
    const offset = parseInt(query.offset);
    const isAdmin = c.get('isAdmin');
    
    const roots = await merkleService.listMerkleRoots(limit, offset);
    
    // If not admin, filter out sensitive information
    if (!isAdmin) {
      const publicRoots = roots.map(root => ({
        ...root,
        // Hide potentially sensitive fields for non-admin users
        submittedAt: undefined,
        validAt: undefined
      }));
      return c.json(publicRoots);
    }
    
    return c.json(roots);
  }
);

// 📖 PUBLIC - Get specific root details (users need this for verification)
merkleRouter.openapi(
  createRoute({
    method: 'get',
    path: '/merkle/roots/{rootId}',
    tags: ['Merkle Trees'],
    summary: 'Get Merkle root details',
    request: {
      param: z.object({
        rootId: z.string()
      })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: MerkleRootSchema
          }
        },
        description: 'Merkle root details'
      },
      404: {
        description: 'Root not found'
      }
    }
  }),
  optionalAuth, // Use optional auth for granular control
  async (c) => {
    const { rootId } = c.req.valid('param');
    const isAdmin = c.get('isAdmin');
    
    const root = await merkleService.getMerkleRoot(rootId);
    
    if (!root) {
      return c.json({ error: 'Merkle root not found' }, 404);
    }

    // If not admin, hide sensitive timestamps
    if (!isAdmin) {
      const publicRoot = {
        ...root,
        submittedAt: undefined,
        validAt: undefined
      };
      return c.json(publicRoot);
    }

    return c.json(root);
  }
);

// 🔒 ADMIN ONLY - Update status
merkleRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/merkle/roots/{rootId}/status',
    tags: ['Merkle Trees'],
    summary: 'Update Merkle root status',
    security: [{ ApiKeyAuth: [] }], // Add security to OpenAPI spec
    request: {
      param: z.object({
        rootId: z.string()
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              status: z.enum(['pending', 'submitted', 'active', 'revoked']),
              submittedAt: z.string().optional(),
              validAt: z.string().optional()
            })
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Status updated successfully'
      },
      401: {
        description: 'Unauthorized - Admin API key required'
      },
      404: {
        description: 'Root not found'
      }
    }
  }),
  adminAuth, // Apply admin auth middleware
  async (c) => {
    const { rootId } = c.req.valid('param');
    const { status, submittedAt, validAt } = c.req.valid('json');
    
    // Check if root exists
    const root = await merkleService.getMerkleRoot(rootId);
    if (!root) {
      return c.json({ error: 'Merkle root not found' }, 404);
    }

    await merkleService.updateRootStatus(
      rootId, 
      status, 
      submittedAt ? new Date(submittedAt) : undefined,
      validAt ? new Date(validAt) : undefined
    );

    return c.json({ success: true });
  }
);