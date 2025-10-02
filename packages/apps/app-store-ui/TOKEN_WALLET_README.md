# Enhanced Token Wallet Implementation

This implementation provides a comprehensive token wallet management system for the Prometheus Protocol frontend with advanced pagination, search, and metadata features. It allows users to manage token allowances and developers to manage canister wallets.

## ✨ **New Features**

### 🔍 **Advanced Search & Filtering**
- **Server-side Search**: Query KongSwap API with search terms
- **Client-side Search**: Real-time filtering of loaded tokens  
- **Multiple Search Fields**: Search by symbol, name, or canister ID
- **Search Mode Toggle**: Switch between server and client search

### 📄 **Pagination Support**
- **Efficient Loading**: Load tokens in pages (default 50 per page)
- **Load More**: Progressive loading with "Load More" button
- **Pagination Info**: Current page, total pages, and token counts
- **Memory Efficient**: Prevents loading thousands of tokens at once

### 🖼️ **Token Metadata & Logos**
- **Token Logos**: Display official token logos from KongSwap
- **Fallback Images**: Graceful fallback for missing logos
- **Enhanced Token Info**: Token ID, fees, and additional metadata
- **Rich UI**: Visual token representation in all components

## Architecture Overview

The implementation consists of several enhanced components:

### 1. Enhanced Types (`src/types/tokens.ts`)

- `Token`: Enhanced interface with metadata (logoUrl, tokenId, fee)
- `TokenPaginationParams`: Pagination control parameters
- `TokenSearchParams`: Search and filter parameters  
- `TokenRegistryResponse`: Complete response with pagination info
- `TokenBalance` & `TokenAllowance`: Existing balance/allowance types

### 2. Advanced Token Registry Hook (`src/hooks/useTokenRegistry.ts`)

**Core Features:**
- **Pagination**: Load tokens in pages with configurable limits
- **Dual Search Modes**: Server-side API search vs client-side filtering
- **Progressive Loading**: "Load more" functionality for large datasets
- **State Management**: Separate state for all tokens vs current page
- **Real-time Filtering**: Instant client-side search results

**API Methods:**
```typescript
const {
  // Data
  tokens,           // Current page tokens
  allTokens,        // All loaded tokens
  pagination,       // Pagination info
  filteredTokens,   // Client-side filtered tokens
  
  // State
  isLoading,        // Initial loading
  isLoadingMore,    // Loading more pages
  error,            // Error state
  searchTerm,       // Current search term
  
  // Actions
  fetchTokens,      // Fetch with params
  fetchMoreTokens,  // Load next page
  searchTokens,     // Server search
  resetTokens,      // Reset all data
  setSearchTerm     // Update search term
} = useTokenRegistry();
```

### 3. Enhanced TokenManager Component (`src/components/TokenManager.tsx`)

The main component with two operational modes, now enhanced with better token discovery:

#### Balance Mode (Canister Wallet)
- **Visibility**: Only for app owners/developers (`isOwnerOrDeveloper` = true)
- **Functionality**: 
  - Shows tokens with non-zero balances in the target canister
  - Provides withdraw functionality with enhanced UI
  - Syncs balances on demand
  - **New**: Token logo display and metadata
- **Use Case**: Managing the app's treasury

#### Allowance Mode (Token Permissions)
- **Visibility**: All logged-in users
- **Functionality**:
  - Shows allowances granted to the target canister
  - Manages user's token watch list (stored in localStorage)
  - Set/modify allowances with presets (0, 100, 1000, unlimited)
  - **New**: Enhanced token search with logos and metadata
  - **New**: Improved token selection interface
- **Use Case**: End users controlling app permissions

#### `TokenListExample` (`src/components/TokenListExample.tsx`)
- **Comprehensive Demo**: Showcases all registry features
- **Search Controls**: Toggle between server/client search modes
- **Pagination UI**: Load more buttons and pagination info
- **Token Metadata**: Rich display with logos and detailed info
- **Debug Information**: Development insights and state visibility

### 4. Integration Components

#### `AppTokenSection` (`src/components/server-details/AppTokenSection.tsx`)
- Enhanced token loading with pagination support
- Improved error handling and user feedback
- Metadata-aware token display

#### `TokenDemoPage` (`src/pages/TokenDemoPage.tsx`)
- Updated to showcase all new features
- Enhanced documentation and examples
- Real-world usage demonstrations

## Enhanced Usage Examples

### 🔍 **Advanced Token Search**

```typescript
// Server-side search (queries KongSwap API)
await searchTokens('ICP'); // Search for ICP-related tokens

// Client-side search (filters loaded tokens)
setSearchTerm('USD'); // Instantly filter for USD tokens

// Pagination with search
await fetchTokens({ 
  page: 1, 
  limit: 50, 
  search: 'ckBTC' 
});
```

### 📄 **Pagination Management**

```typescript
// Load initial tokens
await fetchTokens({ page: 1, limit: 25 });

// Load more tokens
if (pagination.hasMore) {
  await fetchMoreTokens();
}

// Check pagination state
console.log(`Page ${pagination.currentPage} of ${pagination.totalPages}`);
console.log(`Showing ${tokens.length} of ${pagination.totalCount} tokens`);
```

### 🖼️ **Token Metadata Integration**

```typescript
// Access enhanced token information
tokens.forEach(token => {
  console.log(`${token.symbol}: ${token.name}`);
  console.log(`Logo: ${token.logoUrl}`);
  console.log(`Fee: ${token.fee}`);
  console.log(`Token ID: ${token.tokenId}`);
});
```

## Integration Guide

### Step 1: Add to ServerDetailsPage

```tsx
// Add import
import { AppTokenSection } from '@/components/server-details/AppTokenSection';

// Add to component (after AccessAndBilling section)
{identity && canisterId && (
  <AppTokenSection
    targetPrincipal={canisterId}
    isOwnerOrDeveloper={isOwnerOrDeveloper}
    appName={server.name}
  />
)}
```

### Step 2: Determine Ownership Logic

```tsx
const isOwnerOrDeveloper = useMemo(() => {
  if (!identity) return false;
  
  // For global apps: check if user is the developer/publisher
  if (server.deploymentType === 'global') {
    return identity.getPrincipal().compareTo(server.publisherPrincipal) === 'eq';
  }
  
  // For provisioned apps: user is owner of their instance
  if (server.deploymentType === 'provisioned' && canisterId) {
    return true; // Or call canister method to verify ownership
  }
  
  return false;
}, [identity, server, canisterId]);
```

## Technical Details

### ICRC Standards Used

- **ICRC-1**: For reading token balances
- **ICRC-2**: For managing allowances (approve/allowance methods)

### Authentication

- Uses `ic-use-internet-identity` for user authentication
- Anonymous identity for read-only operations
- Authenticated identity for transactions (approvals, transfers)

### Data Storage

- **Token Watch List**: Stored in localStorage per user
- **Token Registry**: Fetched from KongSwap API
- **Balances/Allowances**: Fetched in real-time from IC

### Error Handling

- Network failures gracefully handled with user feedback
- Invalid amounts/principals validated before submission
- Loading states for all async operations

### Performance

- Parallel API calls for multiple tokens
- Debounced search for token selection
- Cached token registry until manual refresh

## API Endpoints

### KongSwap Token Registry
- **URL**: `https://api.kongswap.io/api/tokens`
- **Format**: Paginated response with `items` array containing token objects
- **Parameters**: 
  - `pagination[page]`: Page number
  - `pagination[limit]`: Items per page  
  - `filters[search]`: Search term (optional)
- **Usage**: Provides comprehensive token list for IC ecosystem

## Local Storage Schema

```typescript
// Key: 'prometheus_watched_tokens'
// Value: string[] (array of canister IDs)
[
  "rdmx6-jaaaa-aaaaa-aaadq-cai",  // ICP
  "xkbr6-jzaaa-aaaah-qcn2q-cai",  // USDC
  // ... other watched token canister IDs
]
```

## Usage Examples

### For End Users
1. Navigate to an app's details page
2. See "Token Allowances" section
3. Add tokens to watch list
4. Set allowances for the app
5. Monitor spending permissions

### For App Developers
1. Navigate to their app's details page
2. See both "Token Allowances" and "Canister Wallet" sections
3. Monitor user allowances
4. Manage app's token holdings
5. Withdraw funds as needed

### For Provisioned App Owners
1. Navigate to their provisioned instance
2. Manage their instance's wallet
3. Set allowances for their personal use
4. Monitor token flows

## Future Enhancements

1. **Transaction History**: Track past allowance changes and withdrawals
2. **Notifications**: Alert users when allowances are consumed
3. **Batch Operations**: Set multiple allowances simultaneously
4. **Advanced Filtering**: Filter tokens by categories, value, etc.
5. **Portfolio View**: Aggregate view across all watched apps
6. **Price Integration**: Show USD values for token amounts

## Testing

Access the demo at `/token-demo` to see all functionality in action. The demo uses a test canister ID and shows both user and developer perspectives.

## Dependencies

- `@dfinity/ledger-icrc`: ICRC standard implementations
- `@dfinity/principal`: Principal type handling
- `@dfinity/utils`: Agent creation utilities
- `ic-use-internet-identity`: Authentication
- `sonner`: Toast notifications

## Security Considerations

- All transactions require user approval via Internet Identity
- Read-only operations use anonymous identity
- No private keys stored in frontend
- Allowance amounts validated before submission
- Principal IDs validated for correct format