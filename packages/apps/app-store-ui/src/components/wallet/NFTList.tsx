import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, ExternalLink, Loader2 } from 'lucide-react';
import { NFTMetadata } from '@/hooks/useNFT';

interface NFTCardProps {
  nft: NFTMetadata;
  onTransfer: (nft: NFTMetadata) => void;
}

export function NFTCard({ nft, onTransfer }: NFTCardProps) {
  const imageUrl = nft.thumbnail || nft.asset || '/images/placeholder-nft.png';

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square relative bg-gray-100 dark:bg-gray-800">
        <img
          src={imageUrl}
          alt={nft.name || `NFT #${nft.tokenIndex}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to placeholder on error
            (e.target as HTMLImageElement).src = '/images/placeholder-nft.png';
          }}
        />
      </div>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {nft.name || `PokedBot #${nft.tokenIndex}`}
        </CardTitle>
        <p className="text-sm text-muted-foreground">Token #{nft.tokenIndex}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={() => onTransfer(nft)}>
          <Send className="h-4 w-4 mr-2" />
          Transfer
        </Button>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a href={nft.asset} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Details
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

interface NFTListProps {
  nfts: NFTMetadata[];
  isLoading: boolean;
  onTransfer: (nft: NFTMetadata) => void;
}

export function NFTList({ nfts, isLoading, onTransfer }: NFTListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">No PokedBots NFTs found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Play PokedBots Racing to collect NFTs
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {nfts.map((nft) => (
        <NFTCard key={nft.tokenId} nft={nft} onTransfer={onTransfer} />
      ))}
    </div>
  );
}
