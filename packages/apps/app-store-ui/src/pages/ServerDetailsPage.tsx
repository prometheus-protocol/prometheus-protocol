import { useParams } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';

// Component Imports
import { ServerHeader } from '@/components/server-details/ServerHeader';
import { SimilarApps } from '@/components/server-details/SimilarApps';
import { ToolsAndResources } from '@/components/server-details/ToolsAndResources';
import { DataSafetySection } from '@/components/server-details/DataSafetySection';
import { ReviewsSection } from '@/components/server-details/ReviewsSection';
import { AboutSection } from '@/components/server-details/AboutSection';
import { useGetAppDetails } from '@/hooks/useAppStore';

// --- Placeholder Components for Loading and Error States ---

// A skeleton component to show while data is being fetched.
// This prevents layout shifts and provides a better user experience.
const ServerDetailsSkeleton = () => (
  <div className="container mx-auto py-8 pb-32 animate-pulse">
    <div className="h-48 bg-gray-700 rounded-lg"></div> {/* Header Skeleton */}
    <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-x-16">
      <div className="lg:col-span-2 space-y-8 mt-8">
        <div className="h-64 bg-gray-700 rounded"></div> {/* About Section */}
        <div className="h-48 bg-gray-700 rounded"></div> {/* Tools Section */}
      </div>
      <div className="lg:col-span-1 space-y-8 mt-8">
        <div className="h-96 bg-gray-700 rounded"></div> {/* Similar Apps */}
      </div>
    </div>
  </div>
);

// A component to display a user-friendly error message.
const ServerDetailsError = () => (
  <div className="container mx-auto py-8 text-center">
    <h2 className="text-2xl font-bold text-red-500">An Error Occurred</h2>
    <p className="mt-2 text-gray-400">
      We couldn't load the details for this app. Please try again later.
    </p>
  </div>
);

export default function ServerDetailsPage() {
  // For clarity, let's rename `serverId` to `wasmHash` to match what the hook expects.
  const { serverId } = useParams<{ serverId: string }>();

  const { data: server, isLoading, isError } = useGetAppDetails(serverId);

  // --- 1. Handle the loading state first ---
  if (isLoading) {
    return <ServerDetailsSkeleton />;
  }

  // --- 2. Handle any query errors ---
  if (isError) {
    return <ServerDetailsError />;
  }

  // --- 3. CRITICAL: Handle the "not found" case ---
  // This is the most important check. If the query succeeds but returns no data
  // (e.g., the hash is invalid), we show the NotFoundPage.
  if (!server) {
    return <NotFoundPage />;
  }

  // If we reach this point, we know `server` is a valid, loaded object.
  // The rest of the component can now safely access its properties.
  return (
    <div className="container mx-auto py-8 pb-32">
      <ServerHeader server={server} onInstallClick={() => {}} />

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-x-16 gap-y-8">
        <main className="lg:col-span-2 space-y-16 mt-8">
          <AboutSection server={server} />
          <ToolsAndResources tools={server.tools} />
          <DataSafetySection safetyInfo={server.dataSafety} />
          <ReviewsSection reviews={server.reviews} />
        </main>

        <aside className="lg:col-span-1 space-y-8">
          {/* Pass the server's unique ID to find similar apps */}
          <SimilarApps currentServerId={server.id} />
        </aside>
      </div>
    </div>
  );
}
