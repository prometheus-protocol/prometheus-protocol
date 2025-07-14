curl -X POST \
  --resolve avqkn-guaaa-aaaaa-qaaea-cai.localhost:4943:127.0.0.1 \
  http://avqkn-guaaa-aaaaa-qaaea-cai.localhost:4943/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=da8f2251eb953f45d7602641b0801862cab8e88c60def34389bd52611a5bdbb0" \
  -d "client_id=test-app-01" \
  -d "client_secret=supersecret"