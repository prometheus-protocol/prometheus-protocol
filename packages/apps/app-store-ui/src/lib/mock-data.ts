// ============================================================================
// MOCK DATA FOR PROMETHEUS PROTOCOL
// ============================================================================
// This file contains all mock data for the application.
// It establishes a single source of truth (`allServers`) and derives
// other lists from it to ensure data consistency.
// ============================================================================

// --- 1. TYPE DEFINITIONS ---

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

export interface Audit {
  type: 'quality' | 'security' | 'build';
  score: number;
  certifiedBy: string;
  certifiedOn: string;
}

export interface Certificate {
  audits: Audit[];
  overallScore: number;
  repoUrl?: string;
  hashes: {
    wasm: string;
    gitCommit: string;
    canisterId: string;
  };
}

/**
 * The comprehensive data structure for a single server.
 * This is used for the server details page.
 */
export interface FeaturedServer {
  id: string;
  name: string;
  category: string;
  publisher: string;
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
  certificate?: Certificate;
  isFeatured?: boolean; // Optional flag for homepage features
}

/**
 * A simplified data structure for server lists.
 */
export interface Server {
  id: string;
  name: string;
  category: string;
  iconUrl: string;
  tier: 'gold' | 'silver' | 'bronze';
}

// --- 2. SINGLE SOURCE OF TRUTH ---
// The master array containing full data for ALL servers.
// All other server lists should be derived from this one.

export const allServers: FeaturedServer[] = [
  // --- Servers from the original `mockServers` list, now with full details ---
  {
    id: 'pixipay',
    name: 'PixiPay: Split & Send',
    publisher: 'Pixi Labs',
    category: 'Payments/Finance',
    iconUrl: '/icons/icon-001.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-001.png',
    galleryImages: ['/banners/banner-001.png'],
    description:
      'PixiPay is a decentralized solution for splitting bills and sending money to friends instantly with crypto. No more waiting for bank transfers or dealing with high fees.',
    keyFeatures: [
      'Instant bill splitting',
      'Peer-to-peer crypto transfers',
      'Multi-currency support',
      'On-chain transaction history',
    ],
    whyThisApp:
      'The easiest and fastest way to manage shared expenses on-chain with full transparency and control.',
    tags: ['Finance', 'Payments', 'Web3', 'Social'],
    tools: [
      {
        name: 'split_bill',
        cost: '0.02',
        description:
          'Create a shared bill and invite friends to pay their share.',
        parameters: 'amount, currency, participants[]',
      },
    ],
    dataSafety: {
      description:
        'All transactions are secured on the blockchain. Your personal financial data is never stored.',
      points: [
        {
          title: 'On-Chain Security',
          description: 'Transactions are immutable and publicly verifiable.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 93,
      repoUrl: 'https://github.com/prometheus-protocol/pixipay',
      audits: [
        {
          type: 'quality',
          score: 90,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'build',
          score: 95,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
      ],
      hashes: {
        wasm: '77792c41dc3f10c2a2a4bac9ae385f16901b92c44f24f5c84711d07a3975a74c',
        gitCommit: 'be75f04f04336fc1fbe48de5c2f012ac23111120',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
  },
  {
    id: 'vaultbox',
    name: 'VaultBox: Encrypted Locker',
    publisher: 'SecureTech',
    category: 'Secure Storage',
    iconUrl: '/icons/icon-002.png',
    tier: 'gold',
    status: 'Coming Soon',
    bannerUrl: '/banners/banner-002.png',
    galleryImages: ['/banners/banner-002.png'],
    description:
      'Store your most important files, documents, and digital assets with military-grade, end-to-end encryption on decentralized storage networks.',
    keyFeatures: [
      'End-to-end encryption',
      'Decentralized storage via IPFS',
      'Secure file sharing with access controls',
      'Version history',
    ],
    whyThisApp:
      'VaultBox provides ultimate security and privacy for your digital life, ensuring that only you can access your data.',
    tags: ['Security', 'Storage', 'Privacy', 'IPFS'],
    tools: [
      {
        name: 'upload_file',
        cost: 'Varies',
        description: 'Securely upload and encrypt a file.',
        parameters: 'file_path, access_list[]',
      },
    ],
    dataSafety: {
      description:
        'Zero-knowledge architecture means we can never access your files. Your keys, your data.',
      points: [
        {
          title: 'Client-Side Encryption',
          description:
            'Files are encrypted on your device before being uploaded.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 95,
      repoUrl: 'https://github.com/prometheus-protocol/vaultbox',
      audits: [
        {
          type: 'build',
          score: 92,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'security',
          score: 98,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
      ],
      hashes: {
        wasm: '77792c41dc3f10c2a2a4bac9ae385f16901b92c44f24f5c84711d07a3975a74c',
        gitCommit: 'be75f04f04336fc1fbe48de5c2f012ac23111120',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
  },
  {
    id: 'drift',
    name: 'Drift: Social Routes',
    publisher: 'Drift Labs',
    category: 'Social Mobility',
    iconUrl: '/icons/icon-003.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-003.png',
    galleryImages: ['/banners/banner-003.png'],
    description:
      'Drift is a social navigation app that lets you create, share, and discover unique routes and points of interest with friends and the community.',
    keyFeatures: [
      'Collaborative route planning',
      'Community-curated landmarks',
      'Live location sharing with friends',
      'Themed city tours',
    ],
    whyThisApp:
      'Turn every journey into an adventure. Explore your city in a new way with routes and recommendations from people you trust.',
    tags: ['Social', 'Navigation', 'Maps', 'Community'],
    tools: [],
    dataSafety: {
      description:
        'Your location data is private by default and only shared when you choose to.',
      points: [
        {
          title: 'You Control Your Data',
          description:
            'Live location sharing is opt-in and can be disabled at any time.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 90,
      repoUrl: 'https://github.com/prometheus-protocol/drift',
      audits: [
        {
          type: 'quality',
          score: 88,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'build',
          score: 92,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'security',
          score: 89,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
      ],
      hashes: {
        wasm: '77792c41dc3f10c2a2a4bac9ae385f16901b92c44f24f5c84711d07a3975a74c',
        gitCommit: 'be75f04f04336fc1fbe48de5c2f012ac23111120',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
  },
  {
    id: 'snapship',
    name: 'SnapShip: Marketplace',
    publisher: 'SnapShip Inc.',
    category: 'Marketplace/Trading',
    iconUrl: '/icons/icon-004.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-001.png',
    galleryImages: ['/banners/banner-001.png'],
    description:
      'A decentralized marketplace for buying and selling physical and digital goods with instant crypto payments and secure, smart contract-based escrow.',
    keyFeatures: [
      'Censorship-resistant listings',
      'Instant crypto payments',
      'Smart contract escrow',
      'Community-based reputation system',
    ],
    whyThisApp:
      'Buy and sell directly with others, without middlemen or high fees. Enjoy instant transactions and secure, trustless escrow.',
    tags: ['Marketplace', 'Web3', 'Crypto', 'E-commerce'],
    tools: [
      {
        name: 'list_item',
        cost: '0.05',
        description: 'List an item for sale on the marketplace.',
        parameters: 'title, description, price, images[]',
      },
    ],
    dataSafety: {
      description:
        'Your personal data is never required. All transactions are secured on-chain.',
      points: [
        {
          title: 'No Personal Data Required',
          description: 'You can buy and sell anonymously.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 92,
      repoUrl: 'https://github.com/prometheus-protocol/snapship',
      audits: [
        {
          type: 'quality',
          score: 90,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'build',
          score: 93,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'security',
          score: 91,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
      ],
      hashes: {
        wasm: '77792c41dc3f10c2a2a4bac9ae385f16901b92c44f24f5c84711d07a3975a74c',
        gitCommit: 'be75f04f04336fc1fbe48de5c2f012ac23111120',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
  },
  {
    id: 'fuzzbot',
    name: 'Fuzzbot: Package Pal',
    publisher: 'Fuzz Innovations',
    category: 'Smart Home/IoT',
    iconUrl: '/icons/icon-005.png',
    tier: 'gold',
    status: 'Coming Soon',
    bannerUrl: '/banners/banner-002.png',
    galleryImages: ['/banners/banner-002.png'],
    description:
      'Fuzzbot integrates with your smart home devices to manage package deliveries, grant temporary access to couriers, and keep a secure log of all activity.',
    keyFeatures: [
      'Smart lock integration',
      'Live video monitoring',
      'Secure access code generation',
      'Delivery event timeline',
    ],
    whyThisApp:
      'Never miss a delivery or worry about package theft again. Fuzzbot is the smart, secure way to manage your deliveries.',
    tags: ['IoT', 'Smart Home', 'Security', 'Logistics'],
    tools: [],
    dataSafety: {
      description:
        'All access logs are stored immutably. Video feeds are encrypted.',
      points: [
        {
          title: 'End-to-End Encryption',
          description: 'Live video and stored clips are encrypted.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 94,
      repoUrl: 'https://github.com/prometheus-protocol/fuzzbot',
      audits: [
        {
          type: 'quality',
          score: 92,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'build',
          score: 95,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
      ],
      hashes: {
        wasm: '77792c41dc3f10c2a2a4bac9ae385f16901b92c44f24f5c84711d07a3975a74c',
        gitCommit: 'be75f04f04336fc1fbe48de5c2f012ac23111120',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
  },
  {
    id: 'prompto',
    name: 'Prompto: Fast Forms',
    publisher: 'Prompto AI',
    category: 'Business Utilities',
    iconUrl: '/icons/icon-006.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-003.png',
    galleryImages: ['/banners/banner-003.png'],
    description:
      "Create complex forms and surveys in seconds with natural language. Prompto's AI understands your needs and builds the perfect data collection tool for you.",
    keyFeatures: [
      'Natural language form creation',
      'AI-suggested field types',
      'Instant data validation',
      'Integration with business tools',
    ],
    whyThisApp:
      'Stop wasting time building forms. Just describe what you need, and let Prompto handle the rest.',
    tags: ['AI', 'Business', 'Productivity', 'Forms'],
    tools: [],
    dataSafety: {
      description:
        'Your form data is encrypted and you have full ownership and control over it.',
      points: [],
    },
    reviews: [],
    certificate: {
      overallScore: 91,
      repoUrl: 'https://github.com/prometheus-protocol/prompto',
      audits: [
        {
          type: 'quality',
          score: 89,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
      ],
      hashes: {
        wasm: '77792c41dc3f10c2a2a4bac9ae385f16901b92c44f24f5c84711d07a3975a74c',
        gitCommit: 'be75f04f04336fc1fbe48de5c2f012ac23111120',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
  },
  {
    id: 'flowforge',
    name: 'FlowForge: Workflow Wizard',
    publisher: 'FlowForge Inc.',
    category: 'Team Productivity',
    iconUrl: '/icons/icon-007.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-001.png',
    galleryImages: ['/banners/banner-001.png'],
    description:
      'Visually build and automate complex team workflows. Connect your favorite apps, set up triggers, and let FlowForge handle the repetitive tasks.',
    keyFeatures: [
      'Visual workflow builder',
      'Hundreds of app integrations',
      'Conditional logic and branching',
      'Team collaboration features',
    ],
    whyThisApp:
      'Empower your team to build powerful automations without writing a single line of code. Save time and reduce errors.',
    tags: ['Productivity', 'Automation', 'Business', 'No-Code'],
    tools: [],
    dataSafety: {
      description:
        'We use industry-standard security practices to protect your data and connections.',
      points: [],
    },
    reviews: [],
  },
  {
    id: 'atlasdrop',
    name: 'Atlas Drop: Secure Send',
    publisher: 'Atlas Labs',
    category: 'Secure Delivery',
    iconUrl: '/icons/icon-008.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-002.png',
    galleryImages: ['/banners/banner-002.png'],
    description:
      'Send large files to anyone, anywhere, with end-to-end encryption and decentralized storage. Files are automatically deleted after download or expiration.',
    keyFeatures: [
      'End-to-end encryption',
      'Large file support (up to 10GB)',
      'Self-destructing links',
      'Password protection',
    ],
    whyThisApp:
      'The most secure way to share sensitive files. Your data is never stored unencrypted and is inaccessible to anyone but the recipient.',
    tags: ['Security', 'File Sharing', 'Privacy'],
    tools: [],
    dataSafety: {
      description:
        'Zero-knowledge architecture ensures complete privacy for your shared files.',
      points: [],
    },
    reviews: [],
    certificate: {
      overallScore: 96,
      repoUrl: 'https://github.com/prometheus-protocol/vaultbox',
      audits: [
        {
          type: 'quality',
          score: 94,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'security',
          score: 98,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
      ],
      hashes: {
        wasm: '77792c41dc3f10c2a2a4bac9ae385f16901b92c44f24f5c84711d07a3975a74c',
        gitCommit: 'be75f04f04336fc1fbe48de5c2f012ac23111120',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
  },
  {
    id: 'meta-manifest',
    name: 'MetaManifest: Chain Tracking',
    publisher: 'MetaManifest Inc.',
    category: 'Supply Chain Tech',
    iconUrl: '/icons/icon-009.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-002.png',
    galleryImages: [
      '/banners/banner-002.png',
      '/banners/banner-001.png',
      '/banners/banner-003.png',
    ],
    description:
      'MetaManifest brings next-generation transparency to your supply chain. Track every asset, shipment, or product in real time, with fully verified records on the blockchain.',
    keyFeatures: [
      'Live tracking',
      'Blockchain audit trails',
      'Custom notifications',
      'Intuitive dashboard',
      'Seamless integration',
    ],
    whyThisApp:
      'Gain peace of mind, reduce manual overhead, and make your supply chain future-proof.',
    tags: ['Blockchain', 'Supply Chain', 'Logistics'],
    tools: [
      {
        name: 'get_config',
        cost: '0.04',
        description: 'Get the complete server configuration as JSON.',
        parameters: 'No parameters required',
      },
    ],
    dataSafety: {
      description: 'Your privacy and data security are our top priorities.',
      points: [
        {
          title: 'On-Chain Transparency',
          description:
            'All tracking and audit records are stored securely on the blockchain.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 97,
      repoUrl: 'https://github.com/prometheus-protocol/vaultbox',
      audits: [
        {
          type: 'build',
          score: 95,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
      ],
      hashes: {
        wasm: '77792c41dc3f10c2a2a4bac9ae385f16901b92c44f24f5c84711d07a3975a74c',
        gitCommit: 'be75f04f04336fc1fbe48de5c2f012ac23111120',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
  },
  {
    id: 'cargocrafter',
    name: 'Cargo Crafter: NFT Freight',
    publisher: 'Cargo Crafter Ltd.',
    category: 'Web3 Logistics',
    iconUrl: '/icons/icon-010.png',
    tier: 'gold',
    status: 'Coming Soon',
    bannerUrl: '/banners/banner-003.png',
    galleryImages: ['/banners/banner-003.png'],
    description:
      'Represent bills of lading and freight ownership as NFTs on the blockchain. Trade, fractionally own, and use shipping assets as collateral in DeFi.',
    keyFeatures: [
      'NFT-based bills of lading',
      'Fractional ownership of cargo',
      'DeFi protocol integration',
      'Real-time asset tracking',
    ],
    whyThisApp:
      'Unlock new liquidity and financial instruments for the logistics industry by bringing real-world assets on-chain.',
    tags: ['Web3', 'NFT', 'DeFi', 'Logistics'],
    tools: [],
    dataSafety: {
      description:
        'Ownership and transfers are cryptographically secured on the blockchain.',
      points: [],
    },
    reviews: [],
    certificate: {
      overallScore: 95,
      repoUrl: 'https://github.com/prometheus-protocol/cargocrafter',
      audits: [
        {
          type: 'quality',
          score: 93,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'build',
          score: 96,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
      ],
      hashes: {
        wasm: '77792c41dc3f10c2a2a4bac9ae385f16901b92c44f24f5c84711d07a3975a74c',
        gitCommit: 'be75f04f04336fc1fbe48de5c2f012ac23111120',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
  },
  {
    id: 'fetchly',
    name: 'Fetchly: Instant Courier',
    publisher: 'Fetchly Inc.',
    category: 'Express Services',
    iconUrl: '/icons/icon-011.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-001.png',
    galleryImages: ['/banners/banner-001.png'],
    description:
      'Get anything in your city delivered in minutes. Fetchly connects you with a network of local couriers ready to pick up and deliver on-demand.',
    keyFeatures: [
      'On-demand delivery',
      'Real-time courier tracking',
      'In-app payments',
      'Multi-stop delivery options',
    ],
    whyThisApp:
      "The fastest and most convenient way to get items across town, whether it's a document, a meal, or a last-minute gift.",
    tags: ['Delivery', 'On-Demand', 'Logistics'],
    tools: [],
    dataSafety: {
      description:
        'Location data is used only for active deliveries and is not stored long-term.',
      points: [],
    },
    reviews: [],
    certificate: {
      overallScore: 72,
      repoUrl: 'https://github.com/prometheus-protocol/fetchly',
      audits: [
        {
          type: 'quality',
          score: 90,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'build',
          score: 64,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
      ],
      hashes: {
        wasm: '77792c41dc3f10c2a2a4bac9ae385f16901b92c44f24f5c84711d07a3975a74c',
        gitCommit: 'be75f04f04336fc1fbe48de5c2f012ac23111120',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
  },
  {
    id: 'routespark',
    name: 'RouteSpark: Smart Maps',
    publisher: 'RouteSpark Inc.',
    category: 'Navigation/Mapping',
    iconUrl: '/icons/icon-012.png',
    tier: 'gold',
    status: 'Now Available',
    bannerUrl: '/banners/banner-002.png',
    galleryImages: ['/banners/banner-002.png'],
    description:
      'RouteSpark uses real-time traffic data and predictive AI to find the most efficient route for your journey, saving you time and fuel.',
    keyFeatures: [
      'Predictive traffic analysis',
      'Multi-modal routing (drive, bike, transit)',
      'Eco-friendly route suggestions',
      'Real-time hazard alerts',
    ],
    whyThisApp:
      'Outsmart traffic with an AI co-pilot that constantly analyzes road conditions to keep you on the fastest path.',
    tags: ['AI', 'Navigation', 'Maps', 'Productivity'],
    tools: [],
    dataSafety: {
      description:
        'Your route history is stored locally on your device and is not uploaded to our servers.',
      points: [],
    },
    reviews: [],
  },
  // --- Other servers from previous lists ---
  {
    id: 'runway-p2p',
    name: 'Runway: P2P Delivery',
    publisher: 'Runway Labs',
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
    ],
    dataSafety: {
      description:
        'Your data is secured on-chain and is only shared between you and your matched courier.',
      points: [
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
    ],
  },
];

// --- 3. DERIVED LISTS ---
// These lists are created from the `allServers` array to ensure consistency.

/**
 * A list of servers to be featured prominently, e.g., on the homepage.
 * Contains full server data.
 */
export const homepageServers: FeaturedServer[] = allServers.filter(
  (server) => server.isFeatured || !server.certificate,
);

/**
 * A simplified list of servers for use in sidebars, etc.
 * Contains only the data needed for a list view.
 */
export const mockServers: Server[] = allServers.map((server) => ({
  id: server.id,
  name: server.name,
  category: server.category,
  iconUrl: server.iconUrl,
  tier: server.tier,
}));
