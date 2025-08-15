export interface Server {
  id: string;
  name: string;
  category: string;
  iconUrl: string;
  tier: 'gold' | 'silver' | 'bronze';
}

export const mockServers: Server[] = [
  // Editors Choice
  {
    id: 'pixipay',
    name: 'PixiPay: Split & Send',
    category: 'Payments/Finance',
    iconUrl: '/icons/icon-001.png',
    tier: 'gold',
  },
  {
    id: 'vaultbox',
    name: 'VaultBox: Encrypted Locker',
    category: 'Secure Storage',
    iconUrl: '/icons/icon-002.png',
    tier: 'gold',
  },
  {
    id: 'drift',
    name: 'Drift: Social Routes',
    category: 'Social Mobility',
    iconUrl: '/icons/icon-003.png',
    tier: 'gold',
  },
  {
    id: 'snapship',
    name: 'SnapShip: Marketplace',
    category: 'Marketplace/Trading',
    iconUrl: '/icons/icon-004.png',
    tier: 'gold',
  },
  {
    id: 'fuzzbot',
    name: 'Fuzzbot: Package Pal',
    category: 'Smart Home/IoT',
    iconUrl: '/icons/icon-005.png',
    tier: 'gold',
  },
  {
    id: 'prompto',
    name: 'Prompto: Fast Forms',
    category: 'Business Utilities',
    iconUrl: '/icons/icon-006.png',
    tier: 'gold',
  },
  // Trending
  {
    id: 'flowforge',
    name: 'FlowForge: Workflow Wizard',
    category: 'Team Productivity',
    iconUrl: '/icons/icon-007.png',
    tier: 'gold',
  },
  {
    id: 'atlasdrop',
    name: 'Atlas Drop: Secure Send',
    category: 'Secure Delivery',
    iconUrl: '/icons/icon-008.png',
    tier: 'gold',
  },
  {
    id: 'metamanifest',
    name: 'MetaManifest: Chain Tracking',
    category: 'Supply Chain Tech',
    iconUrl: '/icons/icon-009.png',
    tier: 'gold',
  },
  {
    id: 'cargocrafter',
    name: 'Cargo Crafter: NFT Freight',
    category: 'Web3 Logistics',
    iconUrl: '/icons/icon-010.png',
    tier: 'gold',
  },
  {
    id: 'fetchly',
    name: 'Fetchly: Instant Courier',
    category: 'Express Services',
    iconUrl: '/icons/icon-011.png',
    tier: 'gold',
  },
  {
    id: 'routespark',
    name: 'RouteSpark: Smart Maps',
    category: 'Navigation/Mapping',
    iconUrl: '/icons/icon-012.png',
    tier: 'gold',
  },
];

// Add this new interface
export interface FeaturedServer extends Server {
  status: 'Coming Soon' | 'Now Available';
  bannerUrl: string;
}

// Add this new mock data array
export const mockFeaturedServers: FeaturedServer[] = [
  {
    id: 'runway-p2p',
    name: 'Runway: P2P Delivery',
    category: 'Logistics Software',
    iconUrl: '/icons/icon-001.png',
    tier: 'gold',
    status: 'Coming Soon',
    bannerUrl: '/banners/banner-001.png',
  },
  {
    id: 'synthcart',
    name: 'SynthCart: Automated Supply',
    category: 'Logistics Software',
    iconUrl: '/icons/icon-002.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-002.png',
  },
  {
    id: 'neonfleet',
    name: 'NeonFleet: Urban Dispatch',
    category: 'AI Logistics',
    iconUrl: '/icons/icon-003.png',
    tier: 'silver',
    status: 'Coming Soon',
    bannerUrl: '/banners/banner-003.png',
  },
  {
    id: 'parcelpal',
    name: 'Parcel Pal: Express Networks',
    category: 'Delivery Platform',
    iconUrl: '/icons/icon-004.png',
    tier: 'bronze',
    status: 'Now Available',
    bannerUrl: '/banners/banner-002.png',
  },
  {
    id: 'shipshape',
    name: 'ShipShape: Smart Logistics',
    category: 'Supply Chain Tech',
    iconUrl: '/icons/icon-005.png',
    tier: 'gold',
    status: 'Coming Soon',
    bannerUrl: '/banners/banner-001.png',
  },
  {
    id: 'fleetflow',
    name: 'FleetFlow: Route Optimization',
    category: 'Transport Management',
    iconUrl: '/icons/icon-006.png',
    tier: 'silver',
    status: 'Now Available',
    bannerUrl: '/banners/banner-003.png',
  },
];
