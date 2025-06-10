# Merkle Rewards Distributor Backend

A robust backend service for managing Merkle tree-based rewards distribution, built with Bun, Hono, and TypeScript. This system fetches vault incentive data, aggregates user rewards from an indexer API, and generates Merkle trees for efficient on-chain reward claiming.

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
   # Edit .env with your configuration
   ```

4. Start the development server:
   ```bash
   bun run dev
   ```

The server will start at `http://localhost:3000` with API documentation at `http://localhost:3000/swagger`.

## CLI Usage

### Generate Merkle Trees

The primary way to generate Merkle trees is through the CLI command:

```bash
# Basic usage (Base chain, active incentives only)
bun run src/commands/generateTree.ts

# Generate for specific chain
bun run src/commands/generateTree.ts --chain-id 1

# Include deprecated vaults
bun run src/commands/generateTree.ts --include-deprecated

# Test with mock data (when indexer returns no results)
bun run src/commands/generateTree.ts --mock-indexer

# Different mock scenarios
bun run src/commands/generateTree.ts --mock-indexer --mock-preset medium
bun run src/commands/generateTree.ts --mock-indexer --mock-users 25

# Dry run (show what would be generated)
bun run src/commands/generateTree.ts --dry-run
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --chain-id <number>` | Chain ID to process | 8453 (Base) |
| `-d, --include-deprecated` | Include deprecated vaults | true |
| `--dry-run` | Preview without generating tree | false |
| `--page-size <number>` | Indexer API page size | 100 |
| `-m, --mock-indexer` | Use mock data instead of real API | false |
| `--mock-preset <preset>` | Use predefined mock scenario | small |
| `--mock-users <number>` | Number of mock users per incentive | 5 |
| `-h, --help` | Show help message | - |

### Mock Presets

For testing purposes, several mock presets are available:

- **small**: 5 users, fixed addresses, normal rewards
- **medium**: 25 users, random addresses, reduced rewards  
- **large**: 100 users, random addresses, low rewards
- **highRewards**: 10 users, fixed addresses, double rewards
- **lowRewards**: 50 users, random addresses, minimal rewards

### Package.json Scripts

```bash
# Development server
bun run dev

# Generate tree (default Base chain)
bun run generate-tree

# Generate fake tree (default Base chain)
bun run generate-tree --mock-indexer

# Generate for specific networks
bun run generate-tree:arbitrum   # Arbitrum
bun run generate-tree:base       # Base

# Build for production
bun run build
bun run start
```

## API Endpoints

### Public Endpoints (No Authentication Required)

- `GET /api/v1/merkle/proof/{account}/{token}` - Get claim proof for specific account/token
- `GET /api/v1/merkle/proofs/{account}` - Get all proofs for an account
- `GET /api/v1/merkle/roots` - List all Merkle roots 

## API Examples

### Getting a Claim Proof For a Specific Account and Token(Public)

```bash
curl http://localhost:3000/api/v1/merkle/proof/0x742d35Cc6535C6532f7E68B582ba7eF9797AB9Ab/0x177E14e8ec24BaBa77B08d96053C08Bf7F37AB49
```

## Configuration

### Environment Variables

```bash
# Server configuration
PORT=3000
```

## Testing

### Mock Data Testing

When the real indexer returns no data, use the mock system:

```bash
# Test with small dataset
bun run src/commands/generateTree.ts --mock-indexer
```

### Example Output

```
🌳 Generating Merkle tree for chain 8453 (including deprecated)...
🎭 Using mock indexer with 5 users per incentive (fixed addresses)
📡 Fetching vault data from: https://api.mgvinfra.com/registry/whitelist?chainId=8453&includeDeprecated=true
📊 Found 9 vaults
💰 Total incentives to process: 4

📦 Processing vault: 0xCC1beacCdA8024bA968D63e6db9f01A15D593C52 (1 incentives)
  🎭 Fetching mock leaderboard for vault 0xCC1beacCdA8024bA968D63e6db9f01A15D593C52...
    ✅ Mock page 1/1: 5 entries
    🎭 Mock Stats for 0xCC1beacCdA8024bA968D63e6db9f01A15D593C52:
       Users: 5
       Total Rewards: 480000.00
       Avg Reward: 96000.00
       Top Reward: 192000.00

🎯 Final result: 20 reward entries

📈 Final Reward Summary:
   0x177E14e8ec24BaBa77B08d96053C08Bf7F37AB49: 1920000.00 MGV total rewards across 20 users

✅ Tree generated successfully!
   Tree ID: 550e8400-e29b-41d4-a716-446655440000
   Duration: 2.34s
```


