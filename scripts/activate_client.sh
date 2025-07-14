dfx canister call oauth_backend activate_client \
  "(\"$NEW_CLIENT_ID\", \"$NEW_CLIENT_SECRET\")"