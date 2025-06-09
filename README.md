# Merkle Rewards Distributor Backend

A robust backend service for managing Merkle tree-based rewards distribution, built with Bun, Hono, Drizzle ORM, and PostgreSQL.

## Features

- **Merkle Tree Generation**: Create and manage Merkle trees for reward distribution
- **Proof Management**: Generate and retrieve proofs for claiming rewards
- **OpenAPI Documentation**: Complete API documentation with Swagger UI
- **Type Safety**: Full TypeScript support with Zod validation

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Database**: PostgreSQL with Drizzle ORM  
- **Merkle Trees**: OpenZeppelin Merkle Tree library
- **API Documentation**: OpenAPI 3.0 with Swagger UI
- **Validation**: Zod schemas

## Quick Start

### Prerequisites

- Bun >= 1.0.0
- Node.js >= 18 (for some dependencies)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. Start the development server:
   ```bash
   bun run dev
   ```

The server will start at `http://localhost:3000` with API documentation at `http://localhost:3000/swagger`.

## API Endpoints

### Merkle Trees
- `GET /api/v1/merkle/proof/{account}/{token}` - Get claim proof
- `GET /api/v1/merkle/proofs/{account}` - Get all proofs for account
- `GET /api/v1/merkle/roots` - List all Merkle roots
- `GET /api/v1/merkle/roots/{rootId}` - Get root details

## Usage Examples



### Getting a Claim Proof (Public)

```bash
curl http://localhost:3000/api/v1/merkle/proof/0x742d35Cc6535C6532f7E68B582ba7eF9797AB9Ab/0xA0b86a33E6411e5A2d4dc1d4A60E8F4C6F6e1234
```

### Updating Root Status (Admin Only)

```bash
curl -X PATCH http://localhost:3000/api/v1/merkle/roots/{rootId}/status \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey $ADMIN_API_KEY" \
  -d '{
    "status": "active",
    "submittedAt": "2024-01-15T10:30:00Z"
  }'
```

## Security Features

### API Key Authentication

- **Admin Operations**: Creating Merkle trees and updating root status require API key authentication
- **Public Operations**: Retrieving proofs and viewing root data are publicly accessible
- **Flexible Auth Format**: Supports both `Bearer <key>` and `ApiKey <key>` formats
- **Environment Configuration**: API key is stored securely in environment variables

### Data Protection

- **Sensitive Data Hiding**: Non-admin users cannot see full tree data or pending root details
- **Status-Based Visibility**: Total rewards are only shown for active roots to public users
- **Audit Trail**: All operations are logged with timestamps and user context

### Recommended Setup

1. **Generate a Strong API Key**:
   ```bash
   # Generate a 256-bit key
   openssl rand -hex 32
   ```

2. **Store Securely**:
   - Use environment variables, not hardcoded values
   - Consider using a secrets management service in production
   - Rotate keys regularly

3. **Network Security**:
   - Use HTTPS in production
   - Consider IP whitelisting for admin endpoints
   - Implement rate limiting for admin operationsd4A60E8F4C6F6e1234
```

## Database Schema

The system uses four main tables:

- **reward_tokens**: Store reward token metadata
- **merkle_roots**: Store Merkle tree roots and metadata  
- **reward_entries**: Store individual reward entries with proofs