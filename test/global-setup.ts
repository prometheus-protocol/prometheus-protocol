import type { GlobalSetupContext } from 'vitest/node';
import { PocketIcServer } from '@dfinity/pic';

let picServer: PocketIcServer;

export async function setup(ctx: GlobalSetupContext) {
  console.log('Starting global PocketIC server...');

  picServer = await PocketIcServer.start({ showCanisterLogs: true });
  // picServer = await PocketIcServer.start({});
  const url = picServer.getUrl();
  ctx.provide('PIC_URL', url);

  // Return the teardown function that Vitest will call on exit
  return async () => {
    console.log('Stopping global PocketIC server...');
    await picServer.stop();
  };
}
