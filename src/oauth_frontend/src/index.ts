import { AuthClient } from '@dfinity/auth-client';
import { HttpAgent, ActorSubclass } from '@dfinity/agent';
import { ApproveParams, IcrcLedgerCanister } from '@dfinity/ledger-icrc';
import { Principal } from '@dfinity/principal';
import { toNullable } from '@dfinity/utils';

import {
  createActor,
  canisterId as auth_canister_id,
} from '../../declarations/oauth_backend';
import { _SERVICE } from '../../declarations/oauth_backend/oauth_backend.did';

// --- UI Element References ---
// Views
const loginView = document.getElementById('loginView');
const paymentView = document.getElementById('paymentView');
const completionView = document.getElementById('completionView');
// Buttons
const loginButton = document.getElementById('loginButton') as HTMLButtonElement;
const approveButton = document.getElementById(
  'approveButton',
) as HTMLButtonElement;
const payButton = document.getElementById('payButton') as HTMLButtonElement;
const completeButton = document.getElementById(
  'completeButton',
) as HTMLButtonElement;
const logoutButton = document.getElementById(
  'logoutButton',
) as HTMLButtonElement;
// Displays & Statuses
const principalDisplay = document.getElementById('principalDisplay');
const approveStatus = document.getElementById('approveStatus');
const payStatus = document.getElementById('payStatus');
const completionStatus = document.getElementById('completionStatus');
const status = document.getElementById('status');

// --- Main Application State ---
let authClient: AuthClient;
let backendActor: ActorSubclass<_SERVICE>;
let ledgerActor: IcrcLedgerCanister;
let sessionId: string | null;

const icrcLedgerCanisterId =
  process.env.CANISTER_ID_ICRC1_LEDGER || process.env.ICRC1_LEDGER_CANISTER_ID;

// --- UI Management ---
type UiState = 'login' | 'payment' | 'completion' | 'invalid';

const updateUi = (state: UiState) => {
  loginView.hidden = state !== 'login';
  paymentView.hidden = state !== 'payment';
  completionView.hidden = state !== 'completion';

  if (state === 'invalid') {
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.innerHTML =
        "<h1>Invalid Entry</h1><p>This page should be accessed via an application's authorization flow.</p>";
    }
  }
};

// --- Core Logic ---
const init = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  sessionId = urlParams.get('session_id');

  authClient = await AuthClient.create();

  if (await authClient.isAuthenticated()) {
    await handleAuthenticated();
  } else if (sessionId) {
    updateUi('login');
  } else {
    updateUi('invalid');
  }
};

const handleAuthenticated = async () => {
  const identity = authClient.getIdentity();
  const agent = new HttpAgent({ identity });
  const userPrincipal = identity.getPrincipal();

  backendActor = createActor(auth_canister_id, { agent });
  ledgerActor = IcrcLedgerCanister.create({
    agent,
    canisterId: Principal.fromText(icrcLedgerCanisterId),
  });

  if (principalDisplay) {
    principalDisplay.innerText = userPrincipal.toText();
  }

  status.hidden = true;

  const subscription = await backendActor.get_subscription();

  if (
    subscription.length > 0 &&
    subscription[0].expires_at > BigInt(Date.now()) * 1000000n
  ) {
    updateUi('completion');
  } else {
    updateUi('payment');
  }
};

const handleLogout = async () => {
  await authClient.logout();
  window.location.reload();
};

// --- Event Listeners ---
loginButton.onclick = async () => {
  status.hidden = false;
  status.innerText = 'Connecting to Internet Identity...';
  await authClient.login({
    identityProvider: process.env.II_URL,
    onSuccess: handleAuthenticated,
    onError: (err) => {
      status.innerText = `Login failed: ${err}`;
    },
  });
};

logoutButton.onclick = handleLogout;

approveButton.onclick = async () => {
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
      updateUi('completion'); // Transition to the final view
    } else {
      throw new Error(JSON.stringify(result.err));
    }
  } catch (error) {
    payStatus.innerText = `Payment failed: ${error.message}`;
    payButton.disabled = false;
  }
};

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
    const result = await backendActor.complete_authorize(
      sessionId,
      userPrincipal,
    );

    if ('ok' in result) {
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
