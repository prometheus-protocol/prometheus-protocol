import { AuthClient } from '@dfinity/auth-client';
import { HttpAgent, ActorSubclass } from '@dfinity/agent';
import { ApproveParams, IcrcLedgerCanister } from '@dfinity/ledger-icrc';
import { Principal } from '@dfinity/principal';
import { toNullable } from '@dfinity/utils';

// Import the generated types and actor creation function
import {
  createActor,
  canisterId as auth_canister_id,
} from '../../declarations/oauth_backend';
import { _SERVICE } from '../../declarations/oauth_backend/oauth_backend.did';

// --- UI Elements ---
const loginButton = document.getElementById('loginButton') as HTMLButtonElement;
const paymentFlowSection = document.getElementById('paymentFlow');
const completionFlowSection = document.getElementById('completionFlow'); // --- NEW ---
const approveButton = document.getElementById(
  'approveButton',
) as HTMLButtonElement;
const payButton = document.getElementById('payButton') as HTMLButtonElement;
const completeButton = document.getElementById(
  'completeButton',
) as HTMLButtonElement; // --- NEW ---
const approveStatus = document.getElementById('approveStatus');
const payStatus = document.getElementById('payStatus');
const completionStatus = document.getElementById('completionStatus'); // --- NEW ---

// --- Main Application State ---
let authClient: AuthClient;
let backendActor: ActorSubclass<_SERVICE>;
let ledgerActor: IcrcLedgerCanister;
let sessionId: string | null; // --- NEW: To store the session ID ---

const icrcLedgerCanisterId =
  process.env.CANISTER_ID_ICRC1_LEDGER || process.env.ICRC1_LEDGER_CANISTER_ID;

const init = async () => {
  // --- NEW: Get session_id from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  sessionId = urlParams.get('session_id');

  authClient = await AuthClient.create();
  const identity = authClient.getIdentity();
  const agent = new HttpAgent({ identity });

  backendActor = createActor(auth_canister_id, { agent });
  ledgerActor = IcrcLedgerCanister.create({
    agent,
    canisterId: Principal.fromText(icrcLedgerCanisterId),
  });

  if (await authClient.isAuthenticated()) {
    handleAuthenticated();
  } else if (!sessionId) {
    // --- NEW: Handle direct access without a session ---
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.innerHTML =
        "<h1>Invalid Entry</h1><p>This page should be accessed via an application's authorization flow.</p>";
    }
  }
};

const handleAuthenticated = async () => {
  loginButton.setAttribute('hidden', 'true');

  const subscription = await backendActor.get_subscription();

  // --- MODIFIED: Show either payment or completion flow ---
  if (
    subscription.length > 0 &&
    subscription[0].expires_at > BigInt(Date.now()) * 1000000n
  ) {
    // User has a valid subscription, show the completion flow.
    paymentFlowSection.setAttribute('hidden', 'true');
    completionFlowSection.removeAttribute('hidden');
  } else {
    // No valid subscription, show the payment flow.
    paymentFlowSection.removeAttribute('hidden');
    completionFlowSection.setAttribute('hidden', 'true');
  }
};

// --- Event Listeners ---
loginButton.onclick = async () => {
  if (!sessionId) {
    alert(
      'Error: No session ID found. Please start from the client application.',
    );
    return;
  }
  await authClient.login({
    identityProvider: process.env.II_URL,
    onSuccess: () => {
      window.location.reload();
    },
  });
};

approveButton.onclick = async () => {
  // This function is correct as you have it.
  approveStatus.innerText = 'Approving...';
  approveButton.disabled = true;
  const SUB_PRICE = 100_00000000n;
  const FEE = 10_000n;
  const approveArgs: ApproveParams = {
    spender: {
      owner: Principal.fromText(auth_canister_id),
      subaccount: toNullable(),
    },
    amount: SUB_PRICE + FEE,
  };
  try {
    await ledgerActor.approve(approveArgs);
    approveStatus.innerText = 'Approval successful!';
    payButton.disabled = false;
  } catch (error) {
    approveStatus.innerText = `Approval failed: ${error.message}`;
    approveButton.disabled = false;
  }
};

payButton.onclick = async () => {
  payStatus.innerText = 'Processing payment...';
  payButton.disabled = true;
  try {
    const result = await backendActor.register_subscription();
    if ('ok' in result) {
      payStatus.innerText = 'Payment successful! Subscription is now active.';
      // --- MODIFIED: Hide payment and show completion flow ---
      paymentFlowSection.setAttribute('hidden', 'true');
      completionFlowSection.removeAttribute('hidden');
    } else {
      throw new Error(JSON.stringify(result.err));
    }
  } catch (error) {
    payStatus.innerText = `Payment failed: ${error.message}`;
    payButton.disabled = false;
  }
};

// --- NEW: Handler for the final "Proceed" button ---
completeButton.onclick = async () => {
  if (!sessionId) {
    completionStatus.innerText = 'Error: Session ID is missing.';
    return;
  }
  completionStatus.innerText = 'Finalizing authorization...';
  completeButton.disabled = true;

  try {
    const identity = authClient.getIdentity();
    const userPrincipal = identity.getPrincipal();
    // Call the backend to get the final redirect URL
    const result = await backendActor.complete_authorize(
      sessionId,
      userPrincipal,
    );

    if ('ok' in result) {
      // Success! Perform the redirect.
      window.location.href = result.ok;
    } else {
      throw new Error(result.err);
    }
  } catch (error) {
    completionStatus.innerText = `Error: ${error.message}`;
    completeButton.disabled = false;
  }
};

// --- Start the app ---
init();
