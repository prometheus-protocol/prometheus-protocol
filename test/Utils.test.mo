import Utils "../src/oauth_backend/oauth/Utils";
import Types "../src/oauth_backend/oauth/Types";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Map "mo:map/Map";
import { test; suite; expect } "mo:test/async";
import HttpParser "mo:http-parser";
import Blob "mo:base/Blob";

// =================================================================================================
// TEST SUITES
// =================================================================================================

await suite(
  "Utils Logic",
  func() : async () {
    // --- Mock Data Setup ---
    // Create a reusable mock context for our tests.
    let mock_context : Types.Context = {
      creator = Principal.fromText("aaaaa-aa");
      self = Principal.fromText("b77ix-eeaaa-aaaaa-qaada-cai");
      var frontend_canister_id = Principal.fromText("bkyz2-fmaaa-aaaaa-qaaaq-cai");
      // The rest of the context fields are not needed for these utils tests.
      authorize_sessions = Map.new();
      auth_codes = Map.new();
      clients = Map.new();
      var signing_key_bytes : Blob = Blob.fromArray([]);
      uri_to_rs_id = Map.new();
      refresh_tokens = Map.new();
      resource_servers = Map.new();
    };

    // Helper to create a mock request with a specific host header.
    func create_mock_request(host : Text) : Types.Request {
      return {
        url = HttpParser.URL("", HttpParser.Headers([]));
        method = "GET";
        body = null;
        headers = HttpParser.Headers([("host", host)]);
        params = null;
      };
    };

    // --- Tests for normalize_uri (Unchanged) ---
    await suite(
      "normalize_uri",
      func() : async () {
        await test(
          "should remove a single trailing slash",
          func() : async () {
            let input = "https://prometheus.io/";
            let expected = "https://prometheus.io";
            expect.text(Utils.normalize_uri(input)).equal(expected);
          },
        );

        await test(
          "should remove multiple trailing slashes",
          func() : async () {
            let input = "https://prometheus.io///";
            let expected = "https://prometheus.io";
            expect.text(Utils.normalize_uri(input)).equal(expected);
          },
        );

        await test(
          "should not change a URI with no trailing slash",
          func() : async () {
            let input = "https://prometheus.io";
            let expected = "https://prometheus.io";
            expect.text(Utils.normalize_uri(input)).equal(expected);
          },
        );

        await test(
          "should not change a URI with a path but no trailing slash",
          func() : async () {
            let input = "https://prometheus.io/path/to/resource";
            let expected = "https://prometheus.io/path/to/resource";
            expect.text(Utils.normalize_uri(input)).equal(expected);
          },
        );

        await test(
          "should handle an empty string correctly",
          func() : async () {
            let input = "";
            let expected = "";
            expect.text(Utils.normalize_uri(input)).equal(expected);
          },
        );
      },
    );

    // --- NEW: Tests for the public get_issuer function ---
    await suite(
      "get_issuer",
      func() : async () {
        await test(
          "should return a production issuer URL",
          func() : async () {
            let mock_req = create_mock_request("b77ix-eeaaa-aaaaa-qaada-cai.icp0.io");
            let expected = "https://b77ix-eeaaa-aaaaa-qaada-cai.icp0.io";
            expect.text(Utils.get_issuer(mock_context, mock_req)).equal(expected);
          },
        );

        await test(
          "should construct a local issuer URL when canister ID is missing from host",
          func() : async () {
            let mock_req = create_mock_request("127.0.0.1:4943");
            let expected = "http://b77ix-eeaaa-aaaaa-qaada-cai.127.0.0.1:4943";
            expect.text(Utils.get_issuer(mock_context, mock_req)).equal(expected);
          },
        );

        await test(
          "should return a local issuer URL when host already contains canister ID",
          func() : async () {
            let mock_req = create_mock_request("b77ix-eeaaa-aaaaa-qaada-cai.localhost:4943");
            let expected = "http://b77ix-eeaaa-aaaaa-qaada-cai.localhost:4943";
            expect.text(Utils.get_issuer(mock_context, mock_req)).equal(expected);
          },
        );

        await test(
          "should return a production issuer URL for a custom domain",
          func() : async () {
            let mock_req = create_mock_request("auth.mydapp.com");
            let expected = "https://auth.mydapp.com";
            expect.text(Utils.get_issuer(mock_context, mock_req)).equal(expected);
          },
        );
      },
    );

    // --- NEW: Tests for the build_frontend_url function ---
    await suite(
      "build_frontend_url",
      func() : async () {
        let route = "/login";
        let session_id = "test-session-123";

        await test(
          "should build a production frontend URL with a subdomain",
          func() : async () {
            let mock_req = create_mock_request("b77ix-eeaaa-aaaaa-qaada-cai.icp0.io");
            let expected = "https://bkyz2-fmaaa-aaaaa-qaaaq-cai.icp0.io/login?session_id=test-session-123";
            expect.text(Utils.build_frontend_url(mock_context, mock_req, route, session_id)).equal(expected);
          },
        );

        await test(
          "should build a local frontend URL with a query parameter",
          func() : async () {
            let mock_req = create_mock_request("127.0.0.1:4943");
            let expected = "http://127.0.0.1:4943/login?canisterId=bkyz2-fmaaa-aaaaa-qaaaq-cai&session_id=test-session-123";
            expect.text(Utils.build_frontend_url(mock_context, mock_req, route, session_id)).equal(expected);
          },
        );

        await test(
          "should handle different routes and session IDs correctly",
          func() : async () {
            let mock_req = create_mock_request("127.0.0.1:4943");
            let expected = "http://127.0.0.1:4943/setup?canisterId=bkyz2-fmaaa-aaaaa-qaaaq-cai&session_id=another-session-abc";
            expect.text(Utils.build_frontend_url(mock_context, mock_req, "/setup", "another-session-abc")).equal(expected);
          },
        );
      },
    );
  },
);
