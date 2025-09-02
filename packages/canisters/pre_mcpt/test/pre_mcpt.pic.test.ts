import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@dfinity/principal';
import { describe, beforeAll, it, expect, inject, beforeEach } from 'vitest';
import { AnonymousIdentity, Identity } from '@dfinity/agent';

import { idlFactory } from '@declarations/pre_mcpt';
import {
  Account,
  type _SERVICE as LedgerService,
  init as mcptInit,
} from '@declarations/pre_mcpt/pre_mcpt.did.js';
import { IDL } from '@dfinity/candid';

const LEDGER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/pre_mcpt/pre_mcpt.wasm',
);

// These constants should now match the hardcoded values in your canister's source code.
// They are used here to verify that the canister is configured as expected.
const MINTING_ACCOUNT_IDENTITY: Identity = createIdentity('minting-account');
const TOKEN_NAME = 'preMCPT';
const TOKEN_SYMBOL = 'PREMCPT';
const TOKEN_DECIMALS = 8;
const TRANSFER_FEE = 10_000n;

// Helper function to create an ICRC-1 Account from a Principal
const principalToAccount = (principal: Principal): Account => ({
  owner: principal,
  subaccount: [],
});

describe('ICRC-1 Soul-Bound Ledger Canister (No-Arg Init)', () => {
  let pic: PocketIc;
  let ledgerActor: Actor<LedgerService>;

  // Define identities for our test actors
  const user1Identity: Identity = createIdentity('user-1-principal');
  const user2Identity: Identity = createIdentity('user-2-principal');
  const anonymousIdentity: Identity = new AnonymousIdentity();

  // Accounts derived from identities
  const mintingAccount = principalToAccount(
    MINTING_ACCOUNT_IDENTITY.getPrincipal(),
  );
  const user1Account = principalToAccount(user1Identity.getPrincipal());
  const user2Account = principalToAccount(user2Identity.getPrincipal());

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);
  });

  // Use beforeEach to get a clean canister state for each test.
  beforeEach(async () => {
    // Deploy a fresh canister instance for each test.
    const fixture = await pic.setupCanister<LedgerService>({
      idlFactory,
      wasm: LEDGER_WASM_PATH,
      // IMPORTANT: The sender of the deployment call is now the minting account.
      // Your canister's init/post_upgrade logic should use `ic.caller()` to set this.
      sender: MINTING_ACCOUNT_IDENTITY.getPrincipal(),
      // No `arg` property is provided, as requested.
      arg: IDL.encode(mcptInit({ IDL }), [[]]),
    });
    ledgerActor = fixture.actor;
  });

  it('should return correct metadata', async () => {
    expect(await ledgerActor.icrc1_name()).toBe(TOKEN_NAME);
    expect(await ledgerActor.icrc1_symbol()).toBe(TOKEN_SYMBOL);
    expect(await ledgerActor.icrc1_decimals()).toBe(TOKEN_DECIMALS);
    expect(await ledgerActor.icrc1_fee()).toBe(TRANSFER_FEE);
  });

  it('should return the deployer as the designated minting account', async () => {
    const results = await ledgerActor.icrc1_minting_account();
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(mintingAccount);
  });

  it('should start with a total supply of 0', async () => {
    const totalSupply = await ledgerActor.icrc1_total_supply();
    expect(totalSupply).toBe(0n);
  });

  it('should report a zero balance for a new user', async () => {
    const balance = await ledgerActor.icrc1_balance_of(user1Account);
    expect(balance).toBe(0n);
  });

  describe('Minting', () => {
    const MINT_AMOUNT = 100_000_000n * 10n ** BigInt(TOKEN_DECIMALS); // 100 Million tokens

    it('should REJECT minting from a non-minter account', async () => {
      ledgerActor.setIdentity(user1Identity);

      const res = await ledgerActor.icrc1_transfer({
        to: user2Account,
        amount: MINT_AMOUNT,
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
      });

      expect(res).toHaveProperty('Err');
      // @ts-ignore
      expect(res.Err).toHaveProperty('GenericError');
      // @ts-ignore
      expect(res.Err.GenericError.message).toMatch(
        /Soulbound tokens can only be transferred by the owner/i,
      );
    });

    it('should REJECT minting from an anonymous account', async () => {
      ledgerActor.setIdentity(anonymousIdentity);

      const res = await ledgerActor.icrc1_transfer({
        to: user1Account,
        amount: MINT_AMOUNT,
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
      });

      expect(res).toHaveProperty('Err');
      // @ts-ignore
      expect(res.Err).toHaveProperty('GenericError');
      // @ts-ignore
      expect(res.Err.GenericError.message).toMatch(
        /Soulbound tokens can only be transferred by the owner/i,
      );
    });

    it('should allow the minting account (the deployer) to mint new tokens', async () => {
      // Set identity to the designated minter
      ledgerActor.setIdentity(MINTING_ACCOUNT_IDENTITY);

      const res = await ledgerActor.icrc1_transfer({
        to: user1Account,
        amount: MINT_AMOUNT,
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
      });

      expect(res).toHaveProperty('Ok');
      // @ts-ignore
      expect(typeof res.Ok).toBe('bigint'); // Mint usually returns the block index

      // Verify state changes
      const user1Balance = await ledgerActor.icrc1_balance_of(user1Account);
      expect(user1Balance).toBe(MINT_AMOUNT);

      const totalSupply = await ledgerActor.icrc1_total_supply();
      expect(totalSupply).toBe(MINT_AMOUNT);
    });
  });

  describe('Transfers (Soul-Bound)', () => {
    const INITIAL_MINT_AMOUNT = 500_000n;

    beforeEach(async () => {
      // Pre-fund user1's account for the transfer tests
      ledgerActor.setIdentity(MINTING_ACCOUNT_IDENTITY);
      await ledgerActor.icrc1_transfer({
        to: user1Account,
        amount: INITIAL_MINT_AMOUNT,
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
      });
    });

    it('should REJECT any attempt to transfer tokens', async () => {
      // Set identity to the user who owns the tokens
      ledgerActor.setIdentity(user1Identity);

      // Attempt to transfer tokens from user1 to user2
      const transferResult = await ledgerActor.icrc1_transfer({
        to: user2Account,
        amount: 100_000n,
        fee: [], // Use default fee
        memo: [],
        from_subaccount: [],
        created_at_time: [],
      });

      // This is the critical assertion for a soul-bound token
      expect(transferResult).toHaveProperty('Err');
      // @ts-ignore
      expect(transferResult.Err.GenericError.message).toMatch(
        /Soulbound tokens can only be transferred by the owner/i,
      );

      // --- VERIFY STATE ---
      // Ensure balances have NOT changed after the failed transfer
      const user1BalanceAfter =
        await ledgerActor.icrc1_balance_of(user1Account);
      expect(user1BalanceAfter).toBe(INITIAL_MINT_AMOUNT);

      const user2BalanceAfter =
        await ledgerActor.icrc1_balance_of(user2Account);
      expect(user2BalanceAfter).toBe(0n);

      const totalSupplyAfter = await ledgerActor.icrc1_total_supply();
      expect(totalSupplyAfter).toBe(INITIAL_MINT_AMOUNT);
    });
  });
});
