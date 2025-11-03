import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBlock } from '@/components/ui/code-block';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AppStoreDetails, buildServerUrl } from '@prometheus-protocol/ic-js';
import { Button } from '../ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Principal } from '@icp-sdk/core/principal';

const clientSetups = [
  {
    id: 'copy',
    name: 'Copy URL',
    icon: 'copy.png',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    icon: 'cursor.png',
    instructions: [
      <>Cmd + Shift + J to open Cursor settings</>,
      <>
        Select <strong>Tools & Integrations</strong>
      </>,
      <>
        Click <strong>New MCP Server</strong>
      </>,
      <>
        Add the MCP to your <strong>mcpServers</strong> config
      </>,
    ],
    filename: '~/.cursor/mcp.json',
    code: (serverName: string, serverUrl: string) => `{
  "mcpServers": {
    "${serverName}": {
      "type": "streamable-http",
      "url": "${serverUrl}"
    }
  }
}`,
  },
  {
    id: 'vscode',
    name: 'VS Code',
    icon: 'vscode.png',
    instructions: [
      <>
        Follow VS Code documentation to{' '}
        <a
          href="https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server-to-your-workspace"
          className="underline text-primary">
          Add an MCP server to your workspace
        </a>{' '}
        using the given configuration
      </>,
      <>
        Start the MCP server according to{' '}
        <a
          href="https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_manage-mcp-servers"
          className="underline text-primary">
          Manage MCP servers
        </a>
      </>,
    ],
    filename: '.vscode/mcp.json',
    code: (serverName: string, serverUrl: string) => `{
  "servers": {
    "${serverName}": {
      "type": "http",
      "url": "${serverUrl}"
    }
  }
}`,
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    icon: 'anthropic.png',
    instructions: [
      <>
        Go to <strong>Settings</strong>
      </>,
      <>
        Select <strong>Developer</strong>
      </>,
      <>
        Click <strong>Edit Config</strong>
      </>,
      <>
        Add to your <strong>mcpServers</strong> config
      </>,
    ],
    filename: 'claude_desktop_config.json',
    code: (serverName: string, serverUrl: string) => `{
  "mcpServers": {
    "${serverName}": {
      "command": "npx",
      "args": ["mcp-remote", "${serverUrl}"]
    }
  }
}`,
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    icon: 'anthropic.png',
    instructionsTitle: 'Run the following command:',
    filename: '',
    code: (serverName: string, serverUrl: string) =>
      `claude mcp add -t http ${serverName} ${serverUrl}`,
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    icon: 'windsurf.png',
    instructions: [
      <>
        <strong>Cmd + ,</strong> to open Windsurf settings
      </>,
      <>
        Go to <strong>MCP Servers</strong>
      </>,
      <>
        Click <strong>Manage MCP servers &gt; View raw config</strong>
      </>,
      <>
        Add the MCP to your <strong>mcpServers</strong> config
      </>,
    ],
    filename: '~/.codeium/windsurf/mcp_config.json',
    code: (serverName: string, serverUrl: string) => `{
  "mcpServers": {
    "${serverName}": {
      "serverUrl": "${serverUrl}"
    }
  }
}`,
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    icon: 'google-gemini.png',
    instructions: [
      <>
        Open your Gemini settings JSON located in{' '}
        <strong>~/.gemini/settings.json</strong> where <strong>~</strong> is
        your home directory.
      </>,
      <>
        Add the MCP to your <strong>mcpServers</strong> config
      </>,
    ],
    filename: '~/.gemini/settings.json',
    code: (serverName: string, serverUrl: string) => `{
  //other settings...
  "mcpServers": {
    "${serverName}": {
      "httpUrl": "${serverUrl}"
    }
  }
}`,
  },
];

// --- 2. THE REFACTORED CONTENT COMPONENT ---
function InstallDialogContent({
  server,
  serverUrl,
}: {
  server: AppStoreDetails;
  serverUrl: string;
}) {
  const [activeClientId, setActiveClientId] = React.useState(
    clientSetups[0].id,
  );
  const activeSetup = clientSetups.find((c) => c.id === activeClientId)!;
  const configKey = server.name.split(':')[0].replace(/\s+/g, '');

  // 3. Add the handler for the copy action
  const handleCopyToClipboard = () => {
    if (!serverUrl) return;
    navigator.clipboard.writeText(serverUrl);
    toast.success('MCP URL copied to clipboard!');
  };

  return (
    <>
      <DialogHeader className="text-left p-6">
        <DialogTitle className="text-xl">MCP Setup Instructions</DialogTitle>
        <DialogDescription>
          Follow the instructions below to set up the {server.name} server.
        </DialogDescription>
      </DialogHeader>

      <Tabs
        value={activeClientId}
        onValueChange={setActiveClientId}
        className="w-full overflow-hidden">
        <div className="border-t border-b border-border">
          <div className="overflow-x-auto">
            <TabsList className="bg-transparent p-0 h-auto rounded-none">
              {clientSetups.map((client) => (
                <TabsTrigger
                  key={client.id}
                  value={client.id}
                  className="relative rounded-none bg-transparent px-8 py-4 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:hidden data-[state=active]:after:block data-[state=active]:border-none data-[state=active]:bg-transparent">
                  {client.id === 'copy' ? (
                    <Copy />
                  ) : (
                    <img
                      src={`/images/${client.icon}`}
                      alt={client.name}
                      className="mr-2 h-4 w-4"
                    />
                  )}
                  {client.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        {/* --- 4. Add conditional rendering for the tab content --- */}
        <div className="p-6">
          {activeSetup.id === 'copy' ? (
            // --- UI for the "Copy URL" tab ---
            <div className="space-y-2">
              <div className="relative">
                <div className="font-mono text-sm p-3 pr-12 bg-muted rounded-md">
                  <code className="break-all">{serverUrl}</code>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-1/2 right-2 -translate-y-1/2 h-8 w-8"
                  onClick={handleCopyToClipboard}>
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Copy URL</span>
                </Button>
              </div>
            </div>
          ) : (
            // --- UI for all other client tabs ---
            <>
              <h3 className="font-semibold mb-4 text-sm">
                {activeSetup.instructionsTitle || 'For manual setup:'}
              </h3>
              {activeSetup.instructions && (
                <ol className="list-decimal list-outside pl-5 space-y-2 text-sm text-muted-foreground mb-6">
                  {activeSetup.instructions.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              )}
              {activeSetup.code && (
                <CodeBlock
                  code={activeSetup.code(configKey, serverUrl || '')}
                  filename={activeSetup.filename}
                />
              )}
            </>
          )}
        </div>
      </Tabs>
    </>
  );
}

export interface InstallDialogProps {
  server: AppStoreDetails;
  canisterId: Principal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallDialog({
  server,
  canisterId,
  open,
  onOpenChange,
}: InstallDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const serverUrl = buildServerUrl(canisterId, server.path);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="min-w-[90vw] lg:min-w-[75vw] xl:min-w-[60vw] p-0 gap-0">
          <InstallDialogContent server={server} serverUrl={serverUrl} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="max-h-[80vh] overflow-y-auto">
          <InstallDialogContent server={server} serverUrl={serverUrl} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
