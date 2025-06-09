  export interface RewardData {
    account: string;
    token: string;
    amount: string;
  }

  export interface MerkleEntry {
    merkleRootId: string;
    account: string;
    tokenAddress: string;
    amount: string;
    proof: string[];
    leafIndex: number;
  }
  
  export interface MerkleTreeData {
    root: string;
    tree: any; // OpenZeppelin StandardMerkleTree
    entries: MerkleEntry[];
  }
  
  export interface CreateTreeRequest {
    rewards: RewardData[];
    ipfsHash?: string;
  }
  
  export interface ClaimProof {
    account: string;
    token: string;
    amount: string;
    proof: string[];
  }

