# Replace placeholders with your actual values
dfx canister call avqkn-guaaa-aaaaa-qaaea-cai register_resource_server '(record { 
  name = "Test SDK Server";
  initial_service_principal = principal "jmjyx-d5aic-g6lug-uhffn-aiuid-pp3wo-mh2d7-oegrk-jrlog-eaqr5-eqe";
  uris = vec { "http://localhost:8079" };
  accepted_payment_canisters = vec { principal "a4tbr-q4aaa-aaaaa-qaafq-cai" };
  scopes = vec {
    record { 0 = "profile:read"; 1 = "View your basic profile information." };
    record { 0 = "image:read"; 1 = "Read and view your images and albums." };
    record { 0 = "image:write"; 1 = "Upload, edit, and organize your images." };
    record { 0 = "image:delete"; 1 = "Permanently delete images from your account." };
    record { 0 = "billing:read"; 1 = "View your subscription status and payment history." }
  }
})'