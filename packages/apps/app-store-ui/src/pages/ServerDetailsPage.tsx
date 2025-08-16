import { useParams } from 'react-router-dom';
import { featuredServers, Server } from '@/lib/mock-data'; // Assuming you have this
import NotFoundPage from './NotFoundPage';

// We will create these components in the next steps
import { ServerHeader } from '@/components/server-details/ServerHeader';
import { MediaGallery } from '@/components/server-details/MediaGallery';
import { SimilarApps } from '@/components/server-details/SimilarApps';
import { ToolsAndResources } from '@/components/server-details/ToolsAndResources';
import { DataSafetySection } from '@/components/server-details/DataSafetySection';
import { ReviewsSection } from '@/components/server-details/ReviewsSection';
import { AboutSection } from '@/components/server-details/AboutSection';

export default function ServerDetailsPage() {
  const { serverId } = useParams<{ serverId: string }>();

  // In a real app, you would fetch this data from an API
  const server = featuredServers.find((s) => s.id === serverId);

  if (!server) {
    return <NotFoundPage />;
  }

  return (
    <div className="container mx-auto py-8 pb-32">
      <ServerHeader server={server} />

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-x-16 gap-y-8">
        <main className="lg:col-span-2 space-y-16 mt-8">
          <AboutSection server={server} />
          <ToolsAndResources tools={server.tools} />
          <DataSafetySection safetyInfo={server.dataSafety} />
          <ReviewsSection reviews={server.reviews} />
        </main>

        <aside className="lg:col-span-1 space-y-8">
          <SimilarApps currentServerId={server.id} />
        </aside>
      </div>
    </div>
  );
}
