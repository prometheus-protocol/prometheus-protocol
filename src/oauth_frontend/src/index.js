import { createActor, canisterId as backendCanisterId } from '../../declarations/oauth_backend';
import { AuthClient } from '@dfinity/auth-client';


const loginButton = document.getElementById('loginButton');
const status = document.getElementById('status');

// Explicitly create the actor using the imported canister ID.
// This is more robust than relying on the default export.
const actor = createActor(backendCanisterId);

loginButton.onclick = async (e) => {
  e.preventDefault();
  loginButton.setAttribute('disabled', true);
  status.innerText = 'Preparing login...';

  // Create an auth client
  const authClient = await AuthClient.create();

  // Start the login process
  await authClient.login({
    // Use the II_URL environment variable
    identityProvider: process.env.II_URL,

    // The new, correct onSuccess callback
    onSuccess: async () => {
      status.innerText = 'Login successful! Completing authorization...';

      // 1. Get the user's identity and principal
      const identity = authClient.getIdentity();
      const user_principal = identity.getPrincipal();

      // 2. Get the session_id from the URL's query parameters
      const urlParams = new URLSearchParams(window.location.search);
      const session_id = urlParams.get('session_id');

      if (!session_id) {
        status.innerText = 'Error: No session_id found in URL.';
        loginButton.removeAttribute('disabled');
        return;
      }

      try {
        // 3. Call the backend to get the final redirect URL
        const final_url = await actor.complete_authorize(session_id, user_principal);
        console.log('Final redirect URL:', final_url);
        
        // 4. Perform the final redirect
        status.innerText = 'Redirecting...';
        window.location.href = final_url;

      } catch (err) {
        console.log('Error during authorization:', err);
        status.innerText = 'Error during authorization: ' + err.message;
        loginButton.removeAttribute('disabled');
      }
    },

    // Handle login errors
    onError: (error) => {
      status.innerText = 'Login failed: ' + error;
      loginButton.removeAttribute('disabled');
    },
  });

  return false;
};