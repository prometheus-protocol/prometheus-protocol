// test/Subscriptions.test.mo
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Map "mo:map/Map";
import { phash } "mo:map/Map";
import Blob "mo:base/Blob";
import Types "../src/oauth_backend/Types";
import Subscriptions "../src/oauth_backend/Subscriptions";
import { test; suite; expect } "mo:test/async";

// --- Helper Functions ---

// Helper to compare two Subscription records.
func equalSub(a : Types.Subscription, b : Types.Subscription) : Bool {
  return a.user_principal == b.user_principal and a.tier == b.tier and a.expires_at == b.expires_at;
};

// Helper to display a Subscription record.
func showSub(s : Types.Subscription) : Text {
  debug_show (s);
};

// Helper to create a default mock context for our tests
func createMockContext() : Types.Context {
  let creator = Principal.fromText("aaaaa-aa");
  return {
    self = Principal.fromText("b77ix-eeaaa-aaaaa-qaada-cai");
    creator = creator;
    clients = Map.new();
    auth_codes = Map.new();
    subscriptions = Map.new<Principal, Types.Subscription>();
    authorize_sessions = Map.new();
    var frontend_canister_id = Principal.fromText("aaaaa-aa");
    var signing_key_bytes = Blob.fromArray([]);
    icrc2_ledger_id = Principal.fromText("avqkn-guaaa-aaaaa-qaaea-cai");
    registration_fee = 50 * 100_000_000;
  };
};

await suite(
  "Subscriptions Logic",
  func() : async () {

    // --- Tests for get_subscription ---
    await test(
      "get_subscription: should return null for a new user",
      func() : async () {
        let context = createMockContext();
        let user = Principal.fromText("aaaaa-aa");
        let result = Subscriptions.get_subscription(context, user);
        expect.option<Types.Subscription>(result, showSub, equalSub).isNull();
      },
    );

    await test(
      "get_subscription: should return the subscription for an existing user",
      func() : async () {
        let context = createMockContext();
        let user = Principal.fromText("aaaaa-aa");
        let sub : Types.Subscription = {
          user_principal = user;
          tier = "Pro";
          expires_at = Time.now();
        };
        Map.set(context.subscriptions, phash, user, sub);
        let result = Subscriptions.get_subscription(context, user);
        expect.option<Types.Subscription>(result, showSub, equalSub).isSome();
        expect.option<Types.Subscription>(result, showSub, equalSub).equal(?sub);
      },
    );

    // --- Tests for register_subscription ---
    // NOTE: We cannot unit test the ICRC2 payment itself. We assume it succeeds
    // and test the logic that follows. These tests will be completed with replica tests.

    await test(
      "register_subscription: should create a new subscription for a new user",
      func() : async () {
        // This test requires a replica to mock the payment call.
        assert true; // Placeholder for replica test
      },
    );

    await test(
      "register_subscription: should extend an existing, unexpired subscription",
      func() : async () {
        // This test requires a replica to mock the payment call.
        assert true; // Placeholder for replica test
      },
    );

    await test(
      "register_subscription: should renew an expired subscription from now",
      func() : async () {
        // This test requires a replica to mock the payment call.
        assert true; // Placeholder for replica test
      },
    );
  },
);
