// ============================================================================
// MOCK DATA FOR PROMETHEUS PROTOCOL
// ============================================================================
// This file contains all mock data for the application.
// It establishes a single source of truth (`allServers`) and derives
// other lists from it to ensure data consistency.
// ============================================================================

import { GITHUB_LINK } from './const';

// --- 1. TYPE DEFINITIONS ---

export interface ServerTool {
  name: string;
  description: string;
  cost: string;
  tokenSymbol?: string; // Optional, if the tool uses a specific token
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
  serverUrl: string;
  iconUrl: string;
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
}

// --- 2. SINGLE SOURCE OF TRUTH ---
// The master array containing full data for ALL servers.
// All other server lists should be derived from this one.

export const allServers: FeaturedServer[] = [
  // --- Servers from the original `mockServers` list, now with full details ---
  {
    id: 'calculator',
    name: 'Calculator',
    publisher: 'MCP Devs',
    serverUrl: 'https://mcp-calculator-mock.run.app/mcp',
    category: 'Utilities',
    iconUrl: '/icons/icon-001.png',
    bannerUrl: '/banners/calculator.webp',
    galleryImages: ['/banners/calculator.webp'],
    description:
      'A simple, reliable calculator server for performing basic arithmetic operations.',
    keyFeatures: [
      'Addition (a + b)',
      'Subtraction (a - b)',
      'Multiplication (a * b)',
      'Division (a / b)',
    ],
    whyThisApp:
      'Perfect for testing MCP integrations or when you need a quick calculation without leaving your development environment. A foundational tool for any MCP developer.',
    tags: ['Utilities', 'Math', 'Calculator', 'Development', 'Mock'],
    tools: [
      {
        name: 'add',
        cost: '0.01',
        description: 'Calculates the sum of two numbers (a + b).',
      },
      {
        name: 'subtract',
        cost: '0.01',
        description: 'Calculates the difference of two numbers (a - b).',
      },
      {
        name: 'multiply',
        cost: '0.01',
        description: 'Calculates the product of two numbers (a * b).',
      },
      {
        name: 'divide',
        cost: '0.01',
        description:
          'Calculates the quotient of two numbers (a / b). Returns an error if b is zero.',
      },
    ],
    dataSafety: {
      description:
        'This server is stateless and does not collect or store any user data.',
      points: [
        {
          title: 'No Data Stored',
          description:
            'All calculations are performed in memory and are not logged or retained.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 98,
      repoUrl: 'https://github.com/prometheus-mcp/mock-calculator',
      audits: [
        {
          type: 'quality',
          score: 99,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/15/2025',
        },
        {
          type: 'build',
          score: 100,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/15/2025',
        },
        {
          type: 'security',
          score: 95,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/15/2025',
        },
      ],
      hashes: {
        wasm: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        gitCommit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        canisterId: 'bmfnl-jqaaa-aaaai-q32ha-cai',
      },
    },
    isFeatured: true, // Featured on homepage
  },
  {
    id: 'pmpfaucet',
    name: 'PMP Token Faucet',
    publisher: 'Prometheus Protocol',
    serverUrl: 'https://mcp-pmp-faucet-644182859805.us-central1.run.app/mcp',
    category: 'Token Faucet',
    iconUrl: '/icons/pp-icon.png',
    bannerUrl: '/banners/pmp-faucet.webp',
    galleryImages: ['/banners/pmp-faucet.webp'],
    description: 'Get PMP tokens for development of Prometheus MCP servers.',
    keyFeatures: [
      'Get tokens for testing and development',
      'Uses On-Chain Identity for secure access',
      'Instant token delivery',
    ],
    whyThisApp:
      'The PMP Token Faucet provides developers with the necessary tokens to build and test their applications on the Prometheus Protocol.',
    tags: ['Faucet', 'Development', 'Testing', 'Tokens'],
    tools: [
      {
        name: 'get_test_tokens',
        cost: '+10',
        description: 'Claim 10 tokens. Your balance cannot exceed 100 tokens.',
      },
    ],
    dataSafety: {
      description:
        'All transactions are secured on the blockchain. Your personal financial data is never stored.',
      points: [
        {
          title: 'On-Chain Transparency',
          description: 'Transactions are immutable and publicly verifiable.',
        },
        {
          title: 'On-Chain OAuth',
          description:
            'Authenticate using Internet Identity. No passwords, no data leaks.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 93,
      repoUrl: `https://github.com/prometheus-protocol/typescript-sdk/tree/main/examples/mcp-pmp-faucet`,
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
    isFeatured: true, // Featured on homepage
  },
  {
    id: 'runway-p2p',
    name: 'P2P Delivery',
    publisher: 'Runway Labs',
    serverUrl: 'https://mcp-runway-p2p-644182859805.us-central1.run.app/mcp',
    category: 'Logistics Software',
    iconUrl: '/icons/icon-001.png',
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
    reviews: [],
  },
  {
    id: 'sentiment',
    name: 'Sentiment Analysis',
    publisher: 'Prometheus Protocol',
    serverUrl: 'https://mcp-sentiment-analysis-b26rjhdb4q-uc.a.run.app/mcp',
    category: 'AI/ML',
    iconUrl: '/icons/pp-icon.png',
    bannerUrl: '/banners/sentiment.webp',
    galleryImages: ['/banners/sentiment.webp'],
    description:
      'This server is a demo to illustrate paid tool invocations using the Internet Computer blockchain. During the OAuth flow you can add tokens to your account and grant an allowance to the MCP server. When you invoke the sentiment analysis tool it will charge your account.',
    keyFeatures: [
      'Analyze text sentiment',
      'Pay per invocation',
      'Secure and private',
    ],
    whyThisApp:
      'Understand the emotional tone of your text data. Perfect for market research, customer feedback, and content analysis.',
    tags: ['AI', 'Sentiment Analysis', 'Text Processing'],
    tools: [
      {
        name: 'analyze_sentiment',
        cost: '0.01',
        description:
          'Analyzes the sentiment of a given text. Returns a detailed score. Costs 0.01 tokens per call.',
      },
    ],
    dataSafety: {
      description:
        'Your text data is processed securely and never stored permanently.',
      points: [
        {
          title: 'Secure Processing',
          description:
            'All data is processed in-memory and not stored long-term.',
        },
        {
          title: 'Transparent Costs',
          description:
            'You control your budget. Costs are clearly defined per tool invocation.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 95,
      repoUrl: `${GITHUB_LINK}/vaultbox`,
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
    isFeatured: true, // Featured on homepage
  },
  {
    id: 'drift',
    name: 'Drift: Social Routes',
    publisher: 'Drift Labs',
    serverUrl: 'https://mcp-drift-644182859805.us-central1.run.app/mcp',
    category: 'Social Mobility',
    iconUrl: '/icons/icon-003.png',
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
    tools: [
      {
        name: 'create_route',
        cost: '0.02',
        description:
          'Create and share a custom route with friends. Costs 0.02 tokens per route.',
      },
      {
        name: 'share_location',
        cost: '0.01',
        description:
          'Share your live location with friends for real-time navigation.',
      },
    ],
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
      repoUrl: `${GITHUB_LINK}/drift`,
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
    serverUrl: 'https://mcp-snapship-644182859805.us-central1.run.app/mcp',
    category: 'Marketplace/Trading',
    iconUrl: '/icons/icon-004.png',
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
      repoUrl: `${GITHUB_LINK}/snapship`,
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
    serverUrl: 'https://mcp-fuzzbot-644182859805.us-central1.run.app/mcp',
    category: 'Smart Home/IoT',
    iconUrl: '/icons/icon-005.png',
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
    tools: [
      {
        name: 'grant_access',
        cost: '0.02',
        description:
          'Generate a secure access code for a courier to deliver your package.',
      },
      {
        name: 'view_logs',
        cost: '0.01',
        description:
          'View the delivery logs and video clips of all package interactions.',
      },
    ],
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
      repoUrl: `${GITHUB_LINK}/fuzzbot`,
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
    serverUrl: 'https://mcp-prompto-644182859805.us-central1.run.app/mcp',
    category: 'Business Utilities',
    iconUrl: '/icons/icon-006.png',
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
    tools: [
      {
        name: 'create_form',
        cost: '0.03',
        description:
          'Create a custom form based on your natural language description. Costs 0.03 tokens per form.',
      },
      {
        name: 'validate_data',
        cost: '0.01',
        description:
          'Validate submitted data against your form rules. Costs 0.01 tokens per validation.',
      },
    ],
    dataSafety: {
      description:
        'Your form data is encrypted and you have full ownership and control over it.',
      points: [
        {
          title: 'Data Ownership',
          description:
            'You own all data collected through your forms. Prompto does not store it.',
        },
        {
          title: 'Encryption',
          description:
            'All form submissions are encrypted in transit and at rest.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 91,
      repoUrl: `${GITHUB_LINK}/prompto`,
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
    name: 'Workflow Wizard',
    publisher: 'FlowForge Inc.',
    serverUrl: 'https://mcp-flowforge-644182859805.us-central1.run.app/mcp',
    category: 'Team Productivity',
    iconUrl: '/icons/icon-007.png',
    bannerUrl: '/banners/banner-003.png',
    galleryImages: ['/banners/banner-003.png'],
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
    tools: [
      {
        name: 'create_workflow',
        cost: '0.04',
        description:
          'Create a new workflow using the visual builder. Costs 0.04 tokens per workflow.',
      },
      {
        name: 'run_workflow',
        cost: '0.02',
        description:
          'Execute an existing workflow with the latest data. Costs 0.02 tokens per run.',
      },
    ],
    dataSafety: {
      description:
        'We use industry-standard security practices to protect your data and connections.',
      points: [
        {
          title: 'Secure Connections',
          description:
            'All app integrations use OAuth for secure access without sharing passwords.',
        },
        {
          title: 'Data Encryption',
          description:
            'Your workflow data is encrypted in transit and at rest.',
        },
      ],
    },
    reviews: [],
  },
  {
    id: 'atlasdrop',
    name: 'Atlas Drop: Secure Send',
    publisher: 'Atlas Labs',
    serverUrl: 'https://mcp-atlasdrop-644182859805.us-central1.run.app/mcp',
    category: 'Secure Delivery',
    iconUrl: '/icons/icon-008.png',
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
    tools: [
      {
        name: 'send_file',
        cost: '0.05',
        description:
          'Upload and send a file securely. Costs 0.05 tokens per file sent.',
      },
    ],
    dataSafety: {
      description:
        'Zero-knowledge architecture ensures complete privacy for your shared files.',
      points: [
        {
          title: 'Zero-Knowledge Encryption',
          description:
            'Only you and the recipient can decrypt the file. Not even Atlas Labs can access it.',
        },
        {
          title: 'Self-Destructing Links',
          description:
            'Links expire after download or after a set time, ensuring no lingering access.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 96,
      repoUrl: `${GITHUB_LINK}/vaultbox`,
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
    serverUrl: 'https://mcp-meta-manifest-644182859805.us-central1.run.app/mcp',
    category: 'Supply Chain Tech',
    iconUrl: '/icons/icon-009.png',
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
      repoUrl: `${GITHUB_LINK}/vaultbox`,
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
    serverUrl: 'https://mcp-cargocrafter-644182859805.us-central1.run.app/mcp',
    category: 'Web3 Logistics',
    iconUrl: '/icons/icon-010.png',
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
    tools: [
      {
        name: 'create_bill_of_lading',
        cost: '0.02',
        description:
          'Create a new bill of lading NFT representing a shipment. Costs 0.02 tokens.',
      },
      {
        name: 'transfer_ownership',
        cost: '0.01',
        description:
          'Transfer ownership of a bill of lading NFT to another user. Costs 0.01 tokens.',
      },
    ],
    dataSafety: {
      description:
        'Ownership and transfers are cryptographically secured on the blockchain.',
      points: [
        {
          title: 'Immutable Records',
          description:
            'All transactions are recorded on-chain, ensuring transparency and security.',
        },
        {
          title: 'Decentralized Control',
          description:
            'You maintain full control over your assets without relying on third parties.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 95,
      repoUrl: `${GITHUB_LINK}/cargocrafter`,
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
    serverUrl: 'https://mcp-fetchly-644182859805.us-central1.run.app/mcp',
    category: 'Express Services',
    iconUrl: '/icons/icon-011.png',
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
    tools: [
      {
        name: 'request_delivery',
        cost: '0.05',
        description:
          'Request a courier to pick up and deliver an item. Costs 0.05 tokens per request.',
      },
      {
        name: 'track_courier',
        cost: '0.01',
        description:
          'Track the real-time location of your assigned courier. Costs 0.01 tokens per tracking request.',
      },
    ],
    dataSafety: {
      description:
        'Location data is used only for active deliveries and is not stored long-term.',
      points: [
        {
          title: 'Temporary Location Use',
          description:
            'Your location is shared with the courier only during an active delivery.',
        },
        {
          title: 'Secure Payments',
          description:
            'All transactions are processed securely and your payment information is never stored on our servers.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 72,
      repoUrl: `${GITHUB_LINK}/fetchly`,
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
    serverUrl: 'https://mcp-routespark-644182859805.us-central1.run.app/mcp',
    category: 'Navigation/Mapping',
    iconUrl: '/icons/icon-012.png',
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
    tools: [
      {
        name: 'get_route',
        cost: '0.02',
        description:
          'Calculate the best route from point A to point B, considering real-time traffic and road conditions. Costs 0.02 tokens per route request.',
      },
      {
        name: 'save_route',
        cost: '0.01',
        description:
          'Save a frequently used route for quick access later. Costs 0.01 tokens per saved route.',
      },
    ],
    dataSafety: {
      description:
        'Your route history is stored locally on your device and is not uploaded to our servers.',
      points: [
        {
          title: 'Local Storage',
          description:
            'All route data is stored on your device, ensuring privacy and security.',
        },
        {
          title: 'Anonymized Data',
          description:
            'We only collect anonymized traffic data to improve our algorithms.',
        },
      ],
    },
    reviews: [],
    certificate: {
      overallScore: 88,
      repoUrl: `${GITHUB_LINK}/routespark`,
      audits: [
        {
          type: 'quality',
          score: 85,
          certifiedBy:
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          certifiedOn: '08/22/2025',
        },
        {
          type: 'build',
          score: 90,
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
}));
