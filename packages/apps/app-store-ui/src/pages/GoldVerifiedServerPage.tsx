import { BadgeCheck, Star, ExternalLink, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';

const rubricItems = [
  {
    icon: BadgeCheck,
    text: 'MCP compliance: Inspector connects; tools/list; schemas correct; structured content returned.',
  },
  {
    icon: BadgeCheck,
    text: 'Security: auth for spending tools; no unrestricted transfers; reasonable error handling.',
  },
  {
    icon: BadgeCheck,
    text: 'Docs: README with Quick Start + Inspector steps + example tool calls.',
  },
  {
    icon: BadgeCheck,
    text: 'Quality: clear error messages; idempotency/created_at_time usage; version tag and changelog.',
  },
  {
    icon: BadgeCheck,
    text: 'Maintenance: contact method; repo is open source and looks alive or explicitly maintained.',
  },
  {
    icon: BadgeCheck,
    text: 'Delivery Window: The project must be completed on or before October 20th, 2025.',
  },
  {
    icon: BadgeCheck,
    text: 'Video Verification: A short 2 minute demo video including quote: "I build with Prometheus Protocol."',
  },
];

export default function GoldVerifiedServerPage() {
  const tierInfo = getTierInfo('Gold');

  return (
    <div className="w-full max-w-4xl mx-auto py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="flex flex-col items-center justify-center gap-8 mb-6">
          <Badge
            variant="outline"
            className={cn(
              'text-md',
              tierInfo.borderColorClass,
              tierInfo.textColorClass,
            )}>
            <tierInfo.Icon className="h-5 w-5 mr-1" />
            {tierInfo.name}
          </Badge>{' '}
          <h1 className="text-4xl font-bold tracking-tight">
            Gold Verified Server Program
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Join our elite developer program and earn $500 for creating
          high-quality MCP servers. We're looking for developers who can build
          trustworthy, secure, and well-documented applications that meet our
          rigorous standards.
        </p>
      </div>

      {/* Project Rubric Card */}
      <Card className="mb-16 bg-gradient-to-br from-background to-muted/30 rounded-lg">
        <CardContent>
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Project Rubric</h2>
            <p className="text-muted-foreground">
              To ensure every project submitted to Prometheus Protocol meets our
              standards for trust, usability, and security, we've established a
              clear, minimal rubric. This checklist is designed to get their
              work listed and start earning rewards—while giving users and
              auditors confidence in the quality of new MCP-integrated services.
              Meeting these criteria is the first step toward joining a vibrant,
              trustworthy ecosystem.
            </p>
          </div>

          <div className="space-y-4">
            {rubricItems.map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-4">
                <div className="flex-shrink-0">
                  <item.icon className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 p-5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>
                By following this rubric, you'll not only increase your
                project's chances of approval and visibility, but also
                contribute to a healthier, more reliable ecosystem.
              </strong>{' '}
              These minimal requirements keep quality high while making it easy
              for innovators to participate and grow. We look forward to seeing
              your project thrive in the Prometheus Protocol marketplace!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* How to Apply Section */}
      {/* How It Works: 4-Step Process */}
      <div className="text-center mb-16">
        {/* Step-by-step guide can be added here if desired, but the core is the deadline and CTA */}

        {/* --- IMPORTANT DEADLINE --- */}
        <div className="max-w-2xl mx-auto mb-10 p-5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Important Deadline
          </h3>
          <p className="text-blue-700 dark:text-blue-300">
            MCP Servers must be submitted by <strong>October 20th, 2025</strong>{' '}
            to be eligible for the $500 reward. Make sure to plan your
            development timeline accordingly!
          </p>
        </div>

        <h3 className="text-2xl font-bold mb-6">Ready to Apply?</h3>
        <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
          Submit your server concept through our application form. We'll review
          it for quality, originality, and fit within the ecosystem before
          giving you the green light to build.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSe2BacNK8qRh9xP0oF3ifLOmuuRNwEDJPid-wTt9mcbPrhWoQ/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center">
              <Star className="mr-2 h-5 w-5" />
              Apply with Your Server Idea
            </a>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a
              href="https://docs.prometheusprotocol.org/guides/service-devs/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center">
              Developer Documentation
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>

        {/* Terms and Conditions Link */}
        <div className="mt-8 text-center">
          <Button variant="link" size="sm" asChild>
            <Link
              to="/gold-verified-terms"
              className="flex items-center justify-center">
              <FileText className="mr-2 h-4 w-4" />
              Read Full Terms and Conditions
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
