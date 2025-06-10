export interface MockConfig {
    enabled: boolean;
    userCount: number;
    baseRewardMultiplier: number;
    useFixedAddresses: boolean;
  }
  
  // Predefined Anvil test addresses for consistent testing
  export const TEST_ADDRESSES = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"
  ];
  
  export interface LeaderboardEntry {
    position: number;
    user: string;
    vault: string;
    rewards: number;
    currentRewardsPerSecond: number;
  }
  
  export interface IndexerResponse {
    leaderboard: LeaderboardEntry[];
    nPages: number;
    nElements: number;
    isOver: boolean;
    timestamp: number;
  }
  
  export class IndexerMock {
    private config: MockConfig;
  
    constructor(config: MockConfig) {
      this.config = config;
    }
  
    private generateRandomAddress(): string {
      const hex = '0123456789abcdef';
      let address = '0x';
      for (let i = 0; i < 40; i++) {
        address += hex[Math.floor(Math.random() * 16)];
      }
      return address;
    }
  
    generateMockLeaderboard(vaultAddress: string, maxRewards: number): IndexerResponse {
      const userCount = this.config.useFixedAddresses 
        ? Math.min(this.config.userCount, TEST_ADDRESSES.length)
        : this.config.userCount;
      
      const leaderboard: LeaderboardEntry[] = [];
      
      for (let i = 0; i < userCount; i++) {
        const userAddress = this.config.useFixedAddresses 
          ? TEST_ADDRESSES[i]
          : this.generateRandomAddress();
        
        // More sophisticated reward distribution
        const positionWeight = (userCount - i) / userCount;
        const randomFactor = 0.7 + Math.random() * 0.3; // 0.7 to 1.0
        const baseReward = (maxRewards / userCount) * this.config.baseRewardMultiplier;
        const rewards = baseReward * positionWeight * randomFactor;
        
        leaderboard.push({
          position: i + 1,
          user: userAddress,
          vault: vaultAddress,
          rewards: Math.round(rewards * 100) / 100,
          currentRewardsPerSecond: rewards / (30 * 24 * 3600) // Assume 30-day period
        });
      }
  
      return {
        leaderboard,
        nPages: 1,
        nElements: userCount,
        isOver: false,
        timestamp: Math.floor(Date.now() / 1000)
      };
    }
  
    async mockFetch(
      vaultAddress: string,
      startTimestamp: number,
      endTimestamp: number,
      rewardRate: number,
      maxRewards: number,
      page: number = 0,
      pageSize: number = 100
    ): Promise<IndexerResponse> {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
      // For multi-page scenarios
      const totalUsers = this.config.userCount;
      const totalPages = Math.ceil(totalUsers / pageSize);
      const currentPageUsers = Math.min(pageSize, totalUsers - (page * pageSize));
  
      if (page >= totalPages || currentPageUsers <= 0) {
        return {
          leaderboard: [],
          nPages: totalPages,
          nElements: 0,
          isOver: true,
          timestamp: Math.floor(Date.now() / 1000)
        };
      }
  
      const leaderboard: LeaderboardEntry[] = [];
      
      for (let i = 0; i < currentPageUsers; i++) {
        const globalPosition = (page * pageSize) + i;
        const userAddress = this.config.useFixedAddresses 
          ? TEST_ADDRESSES[globalPosition] || this.generateRandomAddress()
          : this.generateRandomAddress();
        
        // Position-based reward calculation
        const positionWeight = (totalUsers - globalPosition) / totalUsers;
        const randomFactor = 0.7 + Math.random() * 0.3;
        const baseReward = (maxRewards / totalUsers) * this.config.baseRewardMultiplier;
        const rewards = baseReward * positionWeight * randomFactor;
        
        leaderboard.push({
          position: globalPosition + 1,
          user: userAddress,
          vault: vaultAddress,
          rewards: Math.round(rewards * 100) / 100,
          currentRewardsPerSecond: rewards / (endTimestamp - startTimestamp)
        });
      }
  
      return {
        leaderboard,
        nPages: totalPages,
        nElements: currentPageUsers,
        isOver: page >= totalPages - 1,
        timestamp: Math.floor(Date.now() / 1000)
      };
    }
  
    // Generate realistic scenarios
    static createConfigs(): Record<string, MockConfig> {
      return {
        // Small test scenario
        small: {
          enabled: true,
          userCount: 5,
          baseRewardMultiplier: 1.0,
          useFixedAddresses: true
        },
        
        // Medium test scenario
        medium: {
          enabled: true,
          userCount: 25,
          baseRewardMultiplier: 0.8,
          useFixedAddresses: false
        },
        
        // Large test scenario
        large: {
          enabled: true,
          userCount: 100,
          baseRewardMultiplier: 0.6,
          useFixedAddresses: false
        },
        
        // High rewards scenario
        highRewards: {
          enabled: true,
          userCount: 10,
          baseRewardMultiplier: 2.0,
          useFixedAddresses: true
        },
        
        // Low rewards scenario
        lowRewards: {
          enabled: true,
          userCount: 50,
          baseRewardMultiplier: 0.1,
          useFixedAddresses: false
        }
      };
    }
  
    // Utility to log mock statistics
    logMockStats(response: IndexerResponse, vaultAddress: string): void {
      const totalRewards = response.leaderboard.reduce((sum, entry) => sum + entry.rewards, 0);
      const avgRewards = totalRewards / response.leaderboard.length;
      
      console.log(`    🎭 Mock Stats for ${vaultAddress}:`);
      console.log(`       Users: ${response.leaderboard.length}`);
      console.log(`       Total Rewards: ${totalRewards.toFixed(2)}`);
      console.log(`       Avg Reward: ${avgRewards.toFixed(2)}`);
      console.log(`       Top Reward: ${response.leaderboard[0]?.rewards.toFixed(2) || '0'}`);
    }
  }
  
  // Default mock configurations
  export const DEFAULT_MOCK_CONFIG: MockConfig = {
    enabled: false,
    userCount: 5,
    baseRewardMultiplier: 1.0,
    useFixedAddresses: true
  };
  
  // Export preset configurations
  export const MOCK_PRESETS = IndexerMock.createConfigs();