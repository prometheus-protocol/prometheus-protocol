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
const completionView = document.getElementById('completionView');
// Buttons
const loginButton = document.getElementById('loginButton') as HTMLButtonElement;
// DELETE: No longer need approveButton or payButton
const completeButton = document.getElementById(
  'completeButton',
) as HTMLButtonElement;
const logoutButton = document.getElementById(
  'logoutButton',
) as HTMLButtonElement;
// Displays & Statuses
const principalDisplay = document.getElementById('principalDisplay');
// DELETE: No longer need approveStatus
const completionStatus = document.getElementById('completionStatus');
const status = document.getElementById('status');
const allowanceAmount = document.getElementById(
  'allowanceAmount',
) as HTMLInputElement;
const setAllowanceButton = document.getElementById(
  'setAllowanceButton',
) as HTMLButtonElement;
const allowanceStatus = document.getElementById('allowanceStatus');

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
  // --- THIS IS THE FIX ---
  // 1. Read the sessionId from the URL immediately and unconditionally.
  // This makes it available to all subsequent logic on this page load.
  const urlParams = new URLSearchParams(window.location.search);
  sessionId = urlParams.get('session_id');

  // 2. Create the auth client.
  authClient = await AuthClient.create();

  // 3. Now, branch based on authentication state.
  if (await authClient.isAuthenticated()) {
    // The global sessionId is already set, so handleAuthenticated() will work.
    await handleAuthenticated();
  } else {
    // If not authenticated, decide the UI based on whether a session is active.
    if (sessionId) {
      updateUi('login');
    } else {
      updateUi('invalid');
    }
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

  updateUi('completion');
  status.hidden = true;
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
    onSuccess: async () => {
      status.innerText = 'Successfully logged in!';
      await handleAuthenticated();
    },
    onError: (err) => {
      status.innerText = `Login failed: ${err}`;
    },
  });
};

logoutButton.onclick = handleLogout;

completeButton.onclick = async () => {
  if (!sessionId) {
    completionStatus.innerText = 'Error: Session ID is missing.';
    return;
  }
  completionStatus.innerText = 'Finalizing authorization...';
  completeButton.disabled = true;

  try {
    const result = await backendActor.complete_authorize(sessionId);

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

setAllowanceButton.onclick = async () => {
  const amountStr = allowanceAmount.value;
  if (!amountStr || parseFloat(amountStr) <= 0) {
    allowanceStatus.innerText = 'Please enter a valid amount.';
    return;
  }

  // Convert the user-friendly amount (e.g., 10) to the e8s format (10 * 10^8)
  const amount = BigInt(parseFloat(amountStr) * 100_000_000);

  allowanceStatus.innerText = 'Approving...';
  setAllowanceButton.disabled = true;

  const approveArgs: ApproveParams = {
    spender: {
      owner: Principal.fromText(auth_canister_id),
      subaccount: toNullable(),
    },
    amount: amount,
  };

  try {
    const result = await ledgerActor.approve(approveArgs);
    console.log('Approval result:', result);
    allowanceStatus.innerText = `Successfully approved ${amountStr} tokens!`;
  } catch (error) {
    console.error('Approval failed:', error);
    allowanceStatus.innerText = `Approval failed: ${(error as Error).message}`;
  } finally {
    setAllowanceButton.disabled = false;
  }
};

// --- Start the app ---
init();
