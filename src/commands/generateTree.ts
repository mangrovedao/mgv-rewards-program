#!/usr/bin/env bun

import { MerkleService } from '../services/merkleService';
import { IndexerMock, MockConfig, MOCK_PRESETS, DEFAULT_MOCK_CONFIG } from './mocks/indexerMock';

const REWARDS_URL: string = 'https://api.mgvinfra.com/registry/whitelist';
const INDEXER_URL: string = 'https://indexer.mgvinfra.com/';

// Token address mapping for different chains
const TOKEN_ADDRESSES: Record<number, Record<string, string>> = {
  1: { // Ethereum Mainnet
    'MGV': '0x177E14e8ec24BaBa77B08d96053C08Bf7F37AB49', // Example MGV address
  },
  8453: { // Base
    'MGV': '0x177E14e8ec24BaBa77B08d96053C08Bf7F37AB49', // Example MGV address
  },
  137: { // Polygon
    'MGV': '0x177E14e8ec24BaBa77B08d96053C08Bf7F37AB49', // Example MGV address
  },
  42161: { // Arbitrum
    'MGV': '0x177E14e8ec24BaBa77B08d96053C08Bf7F37AB49', // Example MGV address
  }
};

interface VaultData {
  isDeprecated: boolean;
  address: string;
  incentives: Array<{
    vault: string;
    startTimestamp: number;
    endTimestamp: number;
    maxRewards: number;
    rewardRate: number;
    token: string;
  }>;
}

interface LeaderboardEntry {
  position: number;
  user: string;
  vault: string;
  rewards: number;
  currentRewardsPerSecond: number;
}

interface IndexerResponse {
  leaderboard: LeaderboardEntry[];
  nPages: number;
  nElements: number;
  isOver: boolean;
  timestamp: number;
}

interface RewardData {
  account: string;
  token: string;
  amount: string;
}

interface CliArgs {
  chainId: number;
  includeDeprecated: boolean;
  help: boolean;
  dryRun: boolean;
  minRewards: number;
  pageSize: number;
  mockIndexer: boolean;
  mockPreset: string;
  mockUsers: number;
}

class RewardProcessor {
  private chainId: number;
  private pageSize: number;
  private mockConfig: MockConfig | null;
  private indexerMock: IndexerMock | null;
  
  constructor(chainId: number, pageSize: number = 100, mockConfig: MockConfig | null = null) {
    this.chainId = chainId;
    this.pageSize = pageSize;
    this.mockConfig = mockConfig;
    this.indexerMock = mockConfig?.enabled ? new IndexerMock(mockConfig) : null;
  }

  getTokenAddress(tokenSymbol: string): string {
    const chainTokens = TOKEN_ADDRESSES[this.chainId];
    if (!chainTokens) {
      throw new Error(`No token addresses configured for chain ${this.chainId}`);
    }
    
    const address = chainTokens[tokenSymbol];
    if (!address) {
      throw new Error(`Unknown token symbol '${tokenSymbol}' for chain ${this.chainId}`);
    }
    
    return address;
  }

  async fetchIncentiveLeaderboard(
    vaultAddress: string,
    startTimestamp: number,
    endTimestamp: number,
    rewardRate: number,
    maxRewards: number
  ): Promise<LeaderboardEntry[]> {
    
    if (this.indexerMock) {
      console.log(`  🎭 Fetching mock leaderboard for vault ${vaultAddress}...`);
      
      const allEntries: LeaderboardEntry[] = [];
      let page = 0;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await this.indexerMock.mockFetch(
          vaultAddress,
          startTimestamp,
          endTimestamp,
          rewardRate,
          maxRewards,
          page,
          this.pageSize
        );

        console.log(response)

        allEntries.push(...response.leaderboard);
        
        if (response.leaderboard.length > 0) {
          console.log(`    ✅ Mock page ${page + 1}/${response.nPages}: ${response.leaderboard.length} entries`);
        }
        
        hasMorePages = !response.isOver && page + 1 < response.nPages;
        page++;
      }

      if (allEntries.length > 0) {
        this.indexerMock.logMockStats({ 
          leaderboard: allEntries, 
          nPages: 1, 
          nElements: allEntries.length, 
          isOver: true, 
          timestamp: Date.now() 
        }, vaultAddress);
      }

      return allEntries;
    }

    // Original indexer logic
    const allEntries: LeaderboardEntry[] = [];
    let page = 0;
    let hasMorePages = true;

    console.log(`  📊 Fetching leaderboard for vault ${vaultAddress}...`);

    while (hasMorePages) {
      try {
        const url = new URL(`${INDEXER_URL}incentives/vaults/${this.chainId}/${vaultAddress}`);
        url.searchParams.set('startTimestamp', startTimestamp.toString());
        url.searchParams.set('endTimestamp', endTimestamp.toString());
        url.searchParams.set('rewardRate', rewardRate.toString());
        url.searchParams.set('maxRewards', maxRewards.toString());
        url.searchParams.set('page', page.toString());
        url.searchParams.set('pageSize', this.pageSize.toString());
        
        console.log(`    📄 Fetching page ${page + 1}...`);
        
        const response = await fetch(url.toString(), {
          headers: {
            'accept': 'application/json'
          }
        });

        if (!response.ok) {
          console.warn(`    ⚠️  Failed to fetch page ${page + 1}: ${response.status} ${response.statusText}`);
          break;
        }

        const data: IndexerResponse = await response.json();
        
        allEntries.push(...data.leaderboard);
        
        console.log(`    ✅ Page ${page + 1}/${data.nPages}: ${data.leaderboard.length} entries`);
        
        // Check if there are more pages
        hasMorePages = page + 1 < data.nPages;
        page++;

        // Add a small delay to avoid rate limiting
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`    ❌ Error fetching page ${page + 1}:`, error);
        break;
      }
    }

    console.log(`  🎯 Total entries fetched: ${allEntries.length}`);
    return allEntries;
  }

  async processIncentive(
    incentive: VaultData['incentives'][0],
    vaultAddress: string
  ): Promise<Map<string, { token: string; amount: bigint }>> {
    console.log(`💰 Processing incentive for vault ${vaultAddress}`);
    console.log(`   Token: ${incentive.token}`);
    console.log(`   Period: ${new Date(incentive.startTimestamp * 1000).toISOString()} - ${new Date(incentive.endTimestamp * 1000).toISOString()}`);
    console.log(`   Max Rewards: ${incentive.maxRewards}`);
    console.log(`   Reward Rate: ${incentive.rewardRate}`);

    const leaderboard = await this.fetchIncentiveLeaderboard(
      vaultAddress,
      incentive.startTimestamp,
      incentive.endTimestamp,
      incentive.rewardRate,
      incentive.maxRewards
    );

    const userRewards = new Map<string, { token: string; amount: bigint }>();
    const tokenAddress = this.getTokenAddress(incentive.token);

    for (const entry of leaderboard) {
      if (entry.rewards > 0) {
        // Convert rewards to smallest unit (assuming 18 decimals for MGV)
        const rewardAmount = BigInt(Math.floor(entry.rewards * Math.pow(10, 18)));
        
        userRewards.set(entry.user, {
          token: tokenAddress,
          amount: rewardAmount
        });
      }
    }

    console.log(`  ✅ Processed ${userRewards.size} users with rewards`);
    return userRewards;
  }

  async processVaultIncentives(vault: VaultData, includeDeprecated: boolean): Promise<Map<string, Map<string, bigint>>> {
    if (vault.isDeprecated && !includeDeprecated) {
      return new Map();
    }

    console.log(`\n📦 Processing vault: ${vault.address} (${vault.incentives.length} incentives)`);
    
    // Map: user -> token -> total amount
    const aggregatedRewards = new Map<string, Map<string, bigint>>();
    const currentTime = Math.floor(Date.now() / 1000);

    for (let i = 0; i < vault.incentives.length; i++) {
      const incentive = vault.incentives[i];
      
      console.log(`\n🎯 Incentive ${i + 1}/${vault.incentives.length}`);

      // Skip future incentives that haven't started
      if (currentTime < incentive.startTimestamp) {
        console.log(`🔮 Skipping future incentive (starts ${new Date(incentive.startTimestamp * 1000).toISOString()})`);
        continue;
      }

      try {
        const incentiveRewards = await this.processIncentive(incentive, vault.address);
        
        // Aggregate rewards by user and token
        for (const [user, reward] of incentiveRewards) {
          if (!aggregatedRewards.has(user)) {
            aggregatedRewards.set(user, new Map());
          }
          
          const userTokens = aggregatedRewards.get(user)!;
          const currentAmount = userTokens.get(reward.token) || BigInt(0);
          userTokens.set(reward.token, currentAmount + reward.amount);
        }
        
      } catch (error) {
        console.error(`❌ Error processing incentive:`, error);
        continue;
      }
    }

    return aggregatedRewards;
  }

  async transformVaultDataToRewards(vaults: VaultData[], includeDeprecated: boolean = false): Promise<RewardData[]> {
    console.log(`🔄 Processing ${vaults.length} vaults...`);
    
    // Global aggregation: user -> token -> total amount
    const globalRewards = new Map<string, Map<string, bigint>>();

    for (let i = 0; i < vaults.length; i++) {
      const vault = vaults[i];
      console.log(`\n📋 Vault ${i + 1}/${vaults.length}`);
      
      const vaultRewards = await this.processVaultIncentives(vault, includeDeprecated);
      
      // Merge vault rewards into global rewards
      for (const [user, userTokens] of vaultRewards) {
        if (!globalRewards.has(user)) {
          globalRewards.set(user, new Map());
        }
        
        const globalUserTokens = globalRewards.get(user)!;
        
        for (const [token, amount] of userTokens) {
          const currentAmount = globalUserTokens.get(token) || BigInt(0);
          globalUserTokens.set(token, currentAmount + amount);
        }
      }
    }

    // Convert to RewardData array
    const rewards: RewardData[] = [];
    
    for (const [user, userTokens] of globalRewards) {
      for (const [token, amount] of userTokens) {
        if (amount > 0) {
          rewards.push({
            account: user,
            token: token,
            amount: amount.toString()
          });
        }
      }
    }

    console.log(`\n🔗 Final aggregation: ${rewards.length} reward entries for ${globalRewards.size} unique users`);
    
    return rewards;
  }
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    chainId: 8453,
    includeDeprecated: true,
    help: false,
    dryRun: false,
    minRewards: 0,
    pageSize: 100,
    mockIndexer: false,
    mockPreset: 'small',
    mockUsers: 5
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--chain-id':
      case '-c':
        const chainId = parseInt(args[i + 1]);
        if (isNaN(chainId)) {
          console.error('Error: --chain-id must be a valid number');
          process.exit(1);
        }
        parsed.chainId = chainId;
        i++;
        break;
        
      case '--include-deprecated':
      case '-d':
        parsed.includeDeprecated = true;
        break;
        
      case '--dry-run':
        parsed.dryRun = true;
        break;
        
      case '--min-rewards':
        const minRewards = parseInt(args[i + 1]);
        if (isNaN(minRewards)) {
          console.error('Error: --min-rewards must be a valid number');
          process.exit(1);
        }
        parsed.minRewards = minRewards;
        i++;
        break;

      case '--page-size':
        const pageSize = parseInt(args[i + 1]);
        if (isNaN(pageSize) || pageSize < 1 || pageSize > 1000) {
          console.error('Error: --page-size must be between 1 and 1000');
          process.exit(1);
        }
        parsed.pageSize = pageSize;
        i++;
        break;

      case '--mock-indexer':
      case '-m':
        parsed.mockIndexer = true;
        break;

      case '--mock-preset':
        const preset = args[i + 1];
        if (!MOCK_PRESETS[preset]) {
          console.error(`Error: Unknown mock preset '${preset}'. Available: ${Object.keys(MOCK_PRESETS).join(', ')}`);
          process.exit(1);
        }
        parsed.mockPreset = preset;
        i++;
        break;

      case '--mock-users':
        const mockUsers = parseInt(args[i + 1]);
        if (isNaN(mockUsers) || mockUsers < 1 || mockUsers > 1000) {
          console.error('Error: --mock-users must be between 1 and 1000');
          process.exit(1);
        }
        parsed.mockUsers = mockUsers;
        i++;
        break;
        
      case '--help':
      case '-h':
        parsed.help = true;
        break;
        
      default:
        console.error(`Error: Unknown argument '${arg}'`);
        console.log('Use --help for usage information');
        process.exit(1);
    }
  }

  return parsed;
}

function showHelp() {
  const presets = Object.keys(MOCK_PRESETS).join(', ');
  
  console.log(`
Advanced Merkle Tree Generator CLI

USAGE:
  bun run src/commands/generateTree.ts [OPTIONS]

OPTIONS:
  -c, --chain-id <number>      Chain ID to generate tree for (default: 8453)
  -d, --include-deprecated     Include deprecated vaults (default: true)
      --dry-run                Show what would be generated without creating tree
      --min-rewards <number>   Minimum reward amount to include (default: 0)
      --page-size <number>     Page size for indexer requests (default: 100)
  -m, --mock-indexer           Use mock data instead of real indexer
      --mock-preset <preset>   Use predefined mock configuration (${presets})
      --mock-users <number>    Number of mock users per incentive (default: 5)
  -h, --help                   Show this help message

MOCK PRESETS:
  small                        5 users, fixed addresses, normal rewards
  medium                       25 users, random addresses, reduced rewards
  large                        100 users, random addresses, low rewards
  highRewards                  10 users, fixed addresses, double rewards
  lowRewards                   50 users, random addresses, minimal rewards

EXAMPLES:
  # Generate tree with real indexer data
  bun run src/commands/generateTree.ts

  # Test with small mock dataset
  bun run src/commands/generateTree.ts --mock-indexer

  # Test with medium mock dataset
  bun run src/commands/generateTree.ts --mock-indexer --mock-preset medium

  # Custom mock configuration
  bun run src/commands/generateTree.ts --mock-indexer --mock-users 15

  # Dry run with high rewards scenario
  bun run src/commands/generateTree.ts --mock-indexer --mock-preset highRewards --dry-run

NOTES:
  - Use --mock-indexer for testing when the real indexer returns no data
  - Mock presets provide different scenarios for comprehensive testing
  - Rewards are aggregated by user and token across all vaults
  - Large leaderboards are fetched in pages to avoid timeouts
`);
}

async function generateTree(
  chainId: number = 8453, 
  includeDeprecated: boolean = false, 
  dryRun: boolean = false, 
  pageSize: number = 100,
  mockConfig: MockConfig
): Promise<string> {
  console.log(`🌳 ${dryRun ? 'Simulating' : 'Generating'} Merkle tree for chain ${chainId}${includeDeprecated ? ' (including deprecated)' : ''}...`);
  
  if (mockConfig.enabled) {
    console.log(`🎭 Using mock indexer with ${mockConfig.userCount} users per incentive (${mockConfig.useFixedAddresses ? 'fixed' : 'random'} addresses)`);
  }
  
  const processor = new RewardProcessor(chainId, pageSize, mockConfig);
  const merkleService = new MerkleService();
  
  try {
    const apiUrl = new URL(REWARDS_URL);
    apiUrl.searchParams.set('chainId', chainId.toString());
    apiUrl.searchParams.set('includeDeprecated', includeDeprecated.toString());

    console.log(`📡 Fetching vault data from: ${apiUrl.toString()}`);
    
    const response = await fetch(apiUrl.toString());
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const vaultData: VaultData[] = await response.json();
    
    if (!Array.isArray(vaultData)) {
      throw new Error('API response is not an array of vault data');
    }
    
    console.log(`📊 Found ${vaultData.length} vaults`);
    
    // Count total incentives
    const totalIncentives = vaultData.reduce((sum, vault) => {
      return sum + vault.incentives.length;
    }, 0);
    
    console.log(`💰 Total incentives to process: ${totalIncentives}`);
    
    if (totalIncentives === 0) {
      console.warn('⚠️  No incentives found. Tree generation skipped.');
      return '';
    }

    // Transform vault data to reward entries by calling the indexer
    const rewards = await processor.transformVaultDataToRewards(vaultData, includeDeprecated);
    
    console.log(`\n🎯 Final result: ${rewards.length} reward entries`);
    
    if (rewards.length === 0) {
      console.warn('⚠️  No user rewards found. Tree generation skipped.');
      return '';
    }

    // Show summary by token
    const totalRewardsByToken: Record<string, bigint> = {};
    const userCountByToken: Record<string, Set<string>> = {};
    
    for (const reward of rewards) {
      if (!totalRewardsByToken[reward.token]) {
        totalRewardsByToken[reward.token] = BigInt(0);
        userCountByToken[reward.token] = new Set();
      }
      totalRewardsByToken[reward.token] += BigInt(reward.amount);
      userCountByToken[reward.token].add(reward.account);
    }

    console.log('\n📈 Final Reward Summary:');
    for (const [token, total] of Object.entries(totalRewardsByToken)) {
      const userCount = userCountByToken[token].size;
      const totalInEther = Number(total) / Math.pow(10, 18);
      console.log(`   ${token}: ${totalInEther.toFixed(2)} MGV total rewards across ${userCount} users`);
    }

    if (dryRun) {
      console.log('\n🔍 Dry run completed. No tree was generated.');
      return '';
    }
    
    const treeId = await merkleService.createMerkleTree(rewards);
    return treeId;
    
  } catch (error) {
    console.error('❌ Error in generateTree:', error);
    throw error;
  }
}

async function main() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    process.exit(0);
  }
  
  // Configure mock settings
  let mockConfig: MockConfig;
  
  if (args.mockIndexer) {
    if (args.mockPreset && MOCK_PRESETS[args.mockPreset]) {
      mockConfig = { ...MOCK_PRESETS[args.mockPreset] };
      // Override userCount if specified
      if (args.mockUsers !== 5) {
        mockConfig.userCount = args.mockUsers;
      }
      console.log(`📋 Using mock preset: ${args.mockPreset}`);
    } else {
      mockConfig = { ...DEFAULT_MOCK_CONFIG, enabled: true, userCount: args.mockUsers };
    }
  } else {
    mockConfig = { ...DEFAULT_MOCK_CONFIG };
  }
  
  try {
    const startTime = Date.now();
    const treeId = await generateTree(args.chainId, args.includeDeprecated, args.dryRun, args.pageSize, mockConfig);
    const duration = Date.now() - startTime;
    
    if (treeId) {
      console.log(`\n✅ Tree generated successfully!`);
      console.log(`   Tree ID: ${treeId}`);
      console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
    }
    
  } catch (error) {
    console.error('\n❌ Error generating tree:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.main) {
  main();
}