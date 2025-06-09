import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { readdir } from 'fs/promises';
import type { RewardData, ClaimProof, MerkleEntry } from '../types/merkle';

export class MerkleService {

  private validateAddress(address: string): string {
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }
    return address.toLowerCase();
  }

  private async getMerkleFiles(): Promise<string[]> {
    try {
      const files = await readdir('./data');
      return files.filter(file => file.startsWith('merkle_') && file.endsWith('.json'));
    } catch (error) {
      console.error('Error reading data directory:', error);
      return [];
    }
  }

  private async loadMerkleData(rootId: string): Promise<any | null> {
    const files = await this.getMerkleFiles();
    
    for (const file of files) {
      try {
        const filePath = `./data/${file}`;
        const data = await Bun.file(filePath).json();
        
        if (data.merkleRoot && data.merkleRoot.id === rootId) {
          return data;
        }
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
        continue;
      }
    }
    
    return null;
  }

  private async getLatestMerkleData(): Promise<any | null> {
    const files = await this.getMerkleFiles();
    
    let latestData = null;
    let latestDate = new Date(0);
    
    for (const file of files) {
      try {
        const filePath = `./data/${file}`;
        const data = await Bun.file(filePath).json();
        
        if (data.merkleRoot && data.merkleRoot.status === 'active') {
          const createdAt = new Date(data.merkleRoot.createdAt);
          if (createdAt > latestDate) {
            latestDate = createdAt;
            latestData = data;
          }
        }
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
        continue;
      }
    }
    
    return latestData;
  }

  async createMerkleTree(rewards: RewardData[], ipfsHash?: string): Promise<string> {
    const treeEntries = rewards.map(reward => {
      const account = this.validateAddress(reward.account);
      const token = this.validateAddress(reward.token);
      
      if (!/^\d+$/.test(reward.amount) || BigInt(reward.amount) <= 0) {
        throw new Error(`Invalid amount: ${reward.amount}`);
      }

      return [account, token, reward.amount];
    });

    let tree: StandardMerkleTree<string[]>;
    
    try {
      // Create the Merkle tree using OpenZeppelin's library
      tree = StandardMerkleTree.of(treeEntries, ['address', 'address', 'uint256']);
    } catch (error) {
      console.error('Error creating Merkle tree:', error);
      throw new Error(`Failed to create Merkle tree: ${error.message}`);
    }

    const root = tree.root;

    const totalRewards: Record<string, string> = {};
    rewards.forEach(reward => {
      const tokenAddress = this.validateAddress(reward.token);
      const current = totalRewards[tokenAddress] || '0';
      totalRewards[tokenAddress] = (BigInt(current) + BigInt(reward.amount)).toString();
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `data/merkle_${timestamp}.json`;
    
    const merkleRoot = {
      id: crypto.randomUUID(),
      root,
      ipfsHash: ipfsHash || null,
      treeData: tree.dump(),
      totalRewards,
      recipientCount: rewards.length,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    const entries : MerkleEntry[] = [];
    for (const [i, [account, token, amount]] of tree.entries()) {
      const proof = tree.getProof(i);
      entries.push({
        merkleRootId: merkleRoot.id,
        account: account as string,
        tokenAddress: token as string,
        amount: amount as string,
        proof: proof,
        leafIndex: i
      });
    }
    
    const data = {
      merkleRoot,
      entries
    };

    
    // Write to file
    await Bun.write(fileName, JSON.stringify(data, null, 2));

    return merkleRoot.id;
  }


  async getProof(account: string, token: string, rootId?: string): Promise<ClaimProof | null> {
    const normalizedAccount = this.validateAddress(account);
    const normalizedToken = this.validateAddress(token);

    let merkleData;
    
    if (rootId) {
      merkleData = await this.loadMerkleData(rootId);
    } else {
      merkleData = await this.getLatestMerkleData();
    }
    
    if (!merkleData) return null;
    
    const entry = merkleData.entries.find((e: any) => 
      e.account.toLowerCase() === normalizedAccount && 
      e.tokenAddress.toLowerCase() === normalizedToken
    );
    
    if (!entry) return null;
    
    return {
      account: entry.account,
      token: entry.tokenAddress,
      amount: entry.amount,
      proof: entry.proof
    };
  }

  
  async getAccountProofs(account: string, rootId?: string): Promise<ClaimProof[]> {
    const normalizedAccount = this.validateAddress(account);

    let merkleData;
    
    if (rootId) {
      merkleData = await this.loadMerkleData(rootId);
      if (!merkleData) return [];
    } else {
      merkleData = await this.getLatestMerkleData();
      if (!merkleData) return [];
    }

    const accountEntries = merkleData.entries.filter((entry: any) => 
      entry.account.toLowerCase() === normalizedAccount
    );
    
    return accountEntries.map((entry: any) => ({
      account: entry.account,
      token: entry.tokenAddress,
      amount: entry.amount,
      proof: entry.proof as string[]
    }));
  }

  async getMerkleRoot(rootId: string) {
    const merkleData = await this.loadMerkleData(rootId);
    return merkleData ? merkleData.merkleRoot : null;
  }

  async updateRootStatus(rootId: string, status: string, submittedAt?: Date, validAt?: Date) {
    const merkleData = await this.loadMerkleData(rootId);
    if (!merkleData) {
      throw new Error(`Merkle root ${rootId} not found`);
    }

    merkleData.merkleRoot.status = status;
    merkleData.merkleRoot.updatedAt = new Date().toISOString();
    
    if (submittedAt) {
      merkleData.merkleRoot.submittedAt = submittedAt.toISOString();
    }
    
    if (validAt) {
      merkleData.merkleRoot.validAt = validAt.toISOString();
    }

    const files = await this.getMerkleFiles();
    
    for (const file of files) {
      try {
        const filePath = `./data/${file}`;
        const existingData = await Bun.file(filePath).json();
        
        if (existingData.merkleRoot && existingData.merkleRoot.id === rootId) {
          // Update the file with new data
          await Bun.write(filePath, JSON.stringify(merkleData, null, 2));
          return;
        }
      } catch (error) {
        console.error(`Error updating file ${file}:`, error);
        continue;
      }
    }
    
    throw new Error(`File for merkle root ${rootId} not found`);
  }

  async listMerkleRoots(limit: number = 50, offset: number = 0) {
    const files = await this.getMerkleFiles();
    const roots = [];
    
    for (const file of files) {
      try {
        const filePath = `./data/${file}`;
        const data = await Bun.file(filePath).json();
        
        if (data.merkleRoot) {
          roots.push(data.merkleRoot);
        }
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
        continue;
      }
    }
    
    roots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return roots.slice(offset, offset + limit);
  }
  async validateProof(account: string, token: string, amount: string, proof: string[], rootId: string): Promise<boolean> {
    const merkleData = await this.loadMerkleData(rootId);
    if (!merkleData) return false;

    try {
      const normalizedAccount = this.validateAddress(account);
      const normalizedToken = this.validateAddress(token);

      const tree = StandardMerkleTree.load(merkleData.merkleRoot.treeData);
      
      return tree.verify([normalizedAccount, normalizedToken, amount], proof);
    } catch (error) {
      console.error('Error validating proof:', error);
      return false;
    }
  }
}