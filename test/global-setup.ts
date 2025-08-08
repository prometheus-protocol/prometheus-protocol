import type { GlobalSetupContext } from 'vitest/node';
import { PocketIc, PocketIcServer } from '@dfinity/pic';

let pic: PocketIcServer | undefined;
let picServer: PocketIcServer;
let keepAliveInterval: NodeJS.Timeout;

export async function setup(ctx: GlobalSetupContext) {
  console.log('Starting global PocketIC server with keep-alive...');

  picServer = await PocketIcServer.start();
  const url = picServer.getUrl();
  ctx.provide('PIC_URL', url);

  // Return the teardown function that Vitest will call on exit
  return async () => {
    console.log('Stopping global PocketIC server...');
    await picServer.stop();
  };
}
