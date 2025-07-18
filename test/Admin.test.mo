import Principal "mo:base/Principal";
import Blob "mo:base/Blob";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Text "mo:base/Text";
import Types "../src/oauth_backend/oauth/Types";
import Admin "../src/oauth_backend/oauth/Admin";
import { test; suite; expect } "mo:test/async";

// =================================================================================================
// HELPER FUNCTIONS FOR TESTING
// =================================================================================================

// Helper to compare two Client records.
func equalClient(a : Types.Client, b : Types.Client) : Bool {
  return a.client_id == b.client_id and a.owner == b.owner and a.client_secret_hash == b.client_secret_hash and a.client_name == b.client_name;
};

// Helper to display a Client record.
func showClient(c : Types.Client) : Text {
  debug_show (c);
};

// NEW: Helper to compare two ResourceServer records.
func equalResourceServer(a : Types.ResourceServer, b : Types.ResourceServer) : Bool {
  return a.resource_server_id == b.resource_server_id and a.owner == b.owner and a.name == b.name and a.payout_principal == b.payout_principal;
};

// NEW: Helper to display a ResourceServer record.
func showResourceServer(rs : Types.ResourceServer) : Text {
  debug_show (rs);
};

// Helper to create a default mock context for our tests
func createMockContext() : Types.Context {
  let creator = Principal.fromText("aaaaa-aa");
  return {
    self = Principal.fromText("b77ix-eeaaa-aaaaa-qaada-cai");
    creator = creator;
    clients = Map.new<Text, Types.Client>();
    resource_servers = Map.new<Text, Types.ResourceServer>(); // Initialized
    auth_codes = Map.new();
    authorize_sessions = Map.new();
    var frontend_canister_id = Principal.fromText("aaaaa-aa");
    var signing_key_bytes = Blob.fromArray([]);
    uri_to_rs_id = Map.new<Text, Text>(); // Initialized
    refresh_tokens = Map.new<Text, Types.RefreshToken>(); // Initialized
  };
};

// =================================================================================================
// TEST SUITES
// =================================================================================================

await suite(
  "Admin Logic",
  func() : async () {

    // --- Tests for Client App Management ---
    await test(
      "add_test_client: should add a client when called by creator",
      func() : async () {
        let context = createMockContext();
        let test_client : Types.Client = {
          client_id = "test-1";
          owner = context.creator;
          client_secret_hash = "h";
          client_name = "c";
          logo_uri = "";
          redirect_uris = [];
          status = #active;
        };
        Admin.add_test_client(context, context.creator, test_client);
        let result = Map.get(context.clients, thash, "test-1");
        expect.option<Types.Client>(result, showClient, equalClient).equal(?test_client);
      },
    );

    // --- NEW TEST SUITE FOR RESOURCE SERVERS ---
    await suite(
      "Resource Server & Payments",
      func() : async () {
        await test(
          "register_resource_server: should create and store a new resource server",
          func() : async () {
            let context = createMockContext();
            let owner = Principal.fromText("aaaaa-aa");
            let payout = Principal.fromText("aaaaa-aa");
            let service_principal = Principal.fromText("aaaaa-aa");

            let new_server = await Admin.register_resource_server(context, owner, "Test Server", ["https://canister_id.ic0.app"], payout, service_principal);

            // Check that the returned object has the correct data
            expect.principal(new_server.owner).equal(owner);
            expect.text(new_server.name).equal("Test Server");
            expect.principal(new_server.payout_principal).equal(payout);
            expect.principal(new_server.service_principals[0]).equal(service_principal);

            // Check that the object was actually stored in the context's map
            let stored_server = Map.get(context.resource_servers, thash, new_server.resource_server_id);
            expect.option<Types.ResourceServer>(stored_server, showResourceServer, equalResourceServer).isSome();
            expect.option<Types.ResourceServer>(stored_server, showResourceServer, equalResourceServer).equal(?new_server);
          },
        );

      },
    );
  },
);
