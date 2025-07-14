curl -X POST \
  --resolve avqkn-guaaa-aaaaa-qaaea-cai.localhost:4943:127.0.0.1 \
  http://avqkn-guaaa-aaaaa-qaaea-cai.localhost:4943/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=0df9b3414a9a925587332245f12882f55412488d5f3f8f40ce5d1b6144312a6a" \
  -d "client_id=test-app-01" \
  -d "client_secret=supersecret"