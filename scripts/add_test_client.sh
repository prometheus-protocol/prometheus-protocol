dfx canister call oauth_backend add_test_client '(record { 
    client_id="test-app-01"; 
    owner=principal "dufoj-kwyyl-gxpil-bc6pr-ud4hn-q7e5q-lcxyl-mmuho-6j2tg-tuaj6-4ae"; 
    client_secret_hash="f75778f7425be4db0369d09af37a6c2b9a83dea0e53e7bd57412e4b060e607f7"; 
    client_name="Local Test App"; 
    logo_uri=""; 
    redirect_uris=vec {"https://jwt.io"} 
})'