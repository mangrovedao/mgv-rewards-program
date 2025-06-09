import {MerkleService} from '../services/merkleService';

const REWARDS_URL : string = 'https://api.mgvinfra.com/';
const INDEXER_URL : string = 'https://indexer.mgvinfra.com/';

async function generateTree(chainId: number = 8453,includeDeprecated: Boolean = false) : Promise<string>{
    const merkleService = new MerkleService();
    const rewards = await fetch(REWARDS_URL)
        .then((response) => response.json());
    const treeId = await merkleService.createMerkleTree(rewards);
    return treeId;
}   


generateTree(1, false)
    .then((treeId) => console.log('Tree generated successfully', treeId))
    .catch((error) => console.error('Error generating tree:', error));
