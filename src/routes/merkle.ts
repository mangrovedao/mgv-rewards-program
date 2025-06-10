import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { MerkleService } from '../services/merkleService';

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
    path: '/merkle/proof/{account}/{token}/{rootId}',
    tags: ['Merkle Trees'],
    summary: 'Get claim proof for account and token',
    request: {
      params: z.object({
        account: z.string(),
        token: z.string(),
        rootId: z.string()
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
    const { account, token, rootId } = c.req.valid('param');
    
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
    path: '/merkle/proofs/{account}/{rootId}',
    tags: ['Merkle Trees'],
    summary: 'Get all claim proofs for an account',
    request: {
      params: z.object({
        account: z.string(),
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
    const { account, rootId } = c.req.valid('param');
    
    const proofs = await merkleService.getAccountProofs(account, rootId);
    return c.json(proofs);
  }
);

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
  async (c) => {
    const query = c.req.valid('query');
    const limit = parseInt(query.limit);
    const offset = parseInt(query.offset);
    
    const roots = await merkleService.listMerkleRoots(limit, offset);
    
    return c.json(roots);
  }
);

