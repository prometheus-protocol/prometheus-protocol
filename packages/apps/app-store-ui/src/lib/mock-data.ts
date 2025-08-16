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
export interface ServerTool {
  name: string;
  description: string;
  parameters: string;
  cost: string;
}

export interface DataSafetyPoint {
  title: string;
  description: string;
}

export interface DataSafety {
  description: string;
  points: DataSafetyPoint[];
}

export interface Review {
  id: string;
  author: string;
  rating: number; // out of 5
  date: string;
  comment: string;
}

export interface FeaturedServer {
  id: string;
  name: string;
  tagline: string;
  category: string;
  iconUrl: string;
  tier: 'gold' | 'silver' | 'bronze';
  status: 'Now Available' | 'Coming Soon';
  bannerUrl: string;
  galleryImages: string[];
  description: string;
  keyFeatures: string[];
  whyThisApp: string;
  tags: string[];
  tools: ServerTool[];
  dataSafety: DataSafety;
  reviews: Review[];
}

// --- 2. THE EXPANDED MOCK DATA ARRAY ---

export const featuredServers: FeaturedServer[] = [
  {
    id: 'meta-manifest', // Added this one to match the design screenshots
    name: 'MetaManifest',
    tagline: 'Chain Tracking',
    category: 'Logistics Software',
    iconUrl: '/icons/icon-002.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-002.png',
    galleryImages: [
      '/banners/banner-002.png',
      '/banners/banner-001.png',
      '/banners/banner-003.png',
    ],
    description:
      "MetaManifest: Chain Tracking brings next-generation transparency and efficiency to your supply chain. Track every asset, shipment, or product in real time, with fully verified records on the blockchain. Whether you're managing global logistics or monitoring local delivery, MetaManifest provides instant insights, automated alerts, and secure, tamper-proof data—every step of the way.",
    keyFeatures: [
      'Live tracking and status updates for every item',
      'Blockchain-powered audit trails for ultimate trust and compliance',
      'Custom notifications for arrivals, delays, and exceptions',
      'Intuitive dashboard with visual maps for total clarity',
      'Seamless integration with existing logistics solutions',
    ],
    whyThisApp:
      'Gain peace of mind, reduce manual overhead, and make your supply chain future-proof—with transparency you can trust.',
    tags: ['Blockchain Applications', 'Supply Chain Management'],
    tools: [
      {
        name: 'get_config',
        cost: '0.04',
        description:
          'Get the complete server configuration as JSON. Config includes fields for: - blockedCommands (array of blocked shell commands) - defaultShell (shell to use for commands) - allowedDirectories...',
        parameters: 'No parameters required',
      },
      {
        name: 'set_config_value',
        cost: '428.32',
        description:
          'Set a specific configuration value by key. WARNING: Should be used in a separate chat from file operations and command execution to prevent security issues. Config keys include: -...',
        parameters: 'key: string, value: any',
      },
      {
        name: 'read_file',
        cost: '1489.40092',
        description:
          'Read the contents of a file from the file system or a URL with optional offset and length parameters. Prefer this over `execute_command` with cat/type for viewing files. Supports partial file reading...',
        parameters: 'path: string, offset?: number, length?: number',
      },
      {
        name: 'read_multiple_files',
        cost: '0.0001',
        description:
          'Write or append to file contents with a configurable line limit per call (default: 50 lines). THIS IS A STRICT REQUIREMENT. ANY file with more than the configured limit MUST BE written in chunks or it...',
        parameters: 'paths: string[]',
      },
    ],
    dataSafety: {
      description: 'Your privacy and data security are our top priorities.',
      points: [
        {
          title: 'No Personal Data Required',
          description:
            'MetaManifest does not collect personal identifiers such as names, email addresses, or phone numbers.',
        },
        {
          title: 'On-Chain Transparency',
          description:
            'All tracking and audit records are stored securely on the blockchain, ensuring tamper-proof, verifiable data without exposing private information.',
        },
        {
          title: 'End-to-End Encryption',
          description:
            'Sensitive operational data is encrypted in transit and at rest.',
        },
        {
          title: 'You Control Access',
          description:
            "Only authorized users within your organization can view or manage your asset data. You decide what's shared and with whom.",
        },
        {
          title: 'No Third-Party Sharing',
          description:
            'We do not sell or share your data with external parties for advertising or analytics.',
        },
      ],
    },
    reviews: [], // No reviews yet to match the design
  },
  {
    id: 'runway-p2p',
    name: 'Runway',
    tagline: 'P2P Delivery',
    category: 'Logistics Software',
    iconUrl: '/icons/icon-001.png',
    tier: 'gold',
    status: 'Coming Soon',
    bannerUrl: '/banners/banner-001.png',
    galleryImages: ['/banners/banner-001.png'],
    description:
      'A decentralized network connecting local couriers with users for fast, reliable, and affordable package delivery.',
    keyFeatures: [
      'Peer-to-peer matching',
      'Real-time tracking',
      'Crypto payments',
    ],
    whyThisApp:
      'Cut out the middleman and get your packages delivered faster and cheaper with a community-powered network.',
    tags: ['P2P', 'Delivery', 'Web3'],
    tools: [
      {
        name: 'request_delivery',
        cost: '0.1',
        description: 'Broadcast a delivery request to nearby couriers.',
        parameters: 'pickup_location, dropoff_location, package_size',
      },
      {
        name: 'track_package',
        cost: '0.01',
        description: 'Get real-time location updates for your active delivery.',
        parameters: 'tracking_id',
      },
    ],
    dataSafety: {
      description:
        'Your data is secured on-chain and is only shared between you and your matched courier.',
      points: [
        {
          title: 'On-Chain Transparency',
          description:
            'All delivery records are stored securely on the blockchain.',
        },
        {
          title: 'End-to-End Encryption',
          description: 'Communications are encrypted.',
        },
      ],
    },
    reviews: [
      {
        id: '1',
        author: 'Alice',
        rating: 5,
        date: '2025-08-15',
        comment: 'Incredibly fast and reliable. A game-changer!',
      },
      {
        id: '2',
        author: 'Bob',
        rating: 4,
        date: '2025-08-14',
        comment: 'Great service, though the app could be a bit more intuitive.',
      },
    ],
  },
  {
    id: 'snapship',
    name: 'SnapShip',
    tagline: 'Marketplace',
    category: 'E-commerce',
    iconUrl: '/icons/icon-003.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-003.png',
    galleryImages: ['/banners/banner-003.png'],
    description:
      'A decentralized marketplace for buying and selling goods with instant crypto payments.',
    keyFeatures: [
      'Decentralized listings',
      'Instant crypto payments',
      'Smart contract escrow',
    ],
    whyThisApp:
      'Buy and sell directly with others, without middlemen or high fees. Enjoy instant transactions and secure escrow.',
    tags: ['Marketplace', 'Web3', 'Crypto'],
    tools: [
      {
        name: 'list_item',
        cost: '0.05',
        description:
          'List an item for sale on the marketplace with details and price.',
        parameters: 'title, description, price, images[]',
      },
      {
        name: 'buy_item',
        cost: '0.02',
        description:
          'Purchase an item from the marketplace using crypto payment.',
        parameters: 'item_id, payment_method',
      },
    ],
    dataSafety: {
      description:
        'Your personal data is never shared. All transactions are secured on-chain.',
      points: [
        {
          title: 'No Personal Data Required',
          description:
            'You can buy and sell anonymously without providing personal information.',
        },
        {
          title: 'On-Chain Security',
          description:
            'All transactions are recorded on the blockchain for transparency and security.',
        },
      ],
    },
    reviews: [],
  },
];
