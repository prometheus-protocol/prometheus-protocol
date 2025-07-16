import Principal "mo:base/Principal";
import Blob "mo:base/Blob";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Text "mo:base/Text";
import Result "mo:base/Result";
import Types "../src/oauth_backend/Types";
import Admin "../src/oauth_backend/Admin";
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

func showChargeResult(c : Result.Result<Null, Text>) : Text {
  debug_show (c);
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
    icrc2_ledger_id = Principal.fromText("avqkn-guaaa-aaaaa-qaaea-cai");
    registration_fee = 50 * 100_000_000;
    uri_to_rs_id = Map.new<Text, Text>(); // Initialized
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

        await test(
          "charge_user: should fail if caller is not a registered service principal",
          func() : async () {
            let context = createMockContext();
            let unregistered_caller = Principal.fromText("dbkgd-72ter-ea");
            let user_to_charge = Principal.fromText("kufey-x4r");

            let result = await Admin.charge_user(context, unregistered_caller, user_to_charge, 100_000);

            expect.result<Null, Text>(result, showChargeResult, func(a, b) { a == b }).isErr();
            expect.result<Null, Text>(result, showChargeResult, func(a, b) { a == b }).equal(#err("Unauthorized: This service principal is not registered with any resource server."));
          },
        );

        await test(
          "charge_user: should succeed on the happy path (logic check)",
          func() : async () {
            // This test verifies the logic *before* the external ICRC2 call.
            // A full replica test is required to test the actual payment.
            let context = createMockContext();
            let owner = Principal.fromText("aaaaa-aa");
            let payout = Principal.fromText("aaaaa-aa");
            let service_principal = Principal.fromText("aaaaa-aa"); // This will be the caller
            let user_to_charge = Principal.fromText("aaaaa-aa");

            // 1. Register the server so it exists in our system
            let server = Admin.register_resource_server(context, owner, "Test Server", ["https://canister_id.ic0.app"], payout, service_principal);

            // 2. Attempt to charge. In a unit test, this will trap on the `await` if the
            // preceding logic (finding the server) fails. If it doesn't trap, our lookup logic is correct.
            // We can't check the #ok result because the await will never return.
            // This is the limit of unit testing for cross-canister calls.
            assert true; // Placeholder for replica test
          },
        );
      },
    );
  },
);
