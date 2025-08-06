import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import Iter "mo:base/Iter";
import Types "../src/auth/oauth/Types";
import Grants "../src/auth/oauth/Grants";
import { test; suite; expect } "mo:test/async";

// =================================================================================================
// HELPER FUNCTIONS FOR TESTING
// =================================================================================================

// Helper to compare two Text values.
func equalText(a : Text, b : Text) : Bool {
  return a == b;
};

// Helper to display a Text value.
func showText(t : Text) : Text {
  return t;
};

func equalResult(a : Result.Result<Text, Text>, b : Result.Result<Text, Text>) : Bool {
  return a == b;
};

func showResult(r : Result.Result<Text, Text>) : Text {
  debug_show (r);
};

// Helper to create a default mock context for our tests
func createMockContext() : Types.Context {
  let creator = Principal.fromText("aaaaa-aa");
  return {
    self = Principal.fromText("b77ix-eeaaa-aaaaa-qaada-cai");
    creator = creator;
    clients = Map.new();
    resource_servers = Map.new();
    auth_codes = Map.new();
    authorize_sessions = Map.new();
    var frontend_canister_id = Principal.fromText("aaaaa-aa");
    var signing_key_bytes = Blob.fromArray([]);
    uri_to_rs_id = Map.new();
    refresh_tokens = Map.new();
    user_grants = Map.new<Principal, Types.UserGrants>(); // <-- NEW: Initialize user_grants
  };
};

// =================================================================================================
// TEST SUITE FOR GRANTS LOGIC
// =================================================================================================

await suite(
  "Grants Logic",
  func() : async () {

    // --- Tests for get_my_grants ---
    await suite(
      "get_my_grants",
      func() : async () {
        await test(
          "should return an empty array for a user with no grants",
          func() : async () {
            let context = createMockContext();
            let user = Principal.fromText("bkyz2-fmaaa-aaaaa-qaaaq-cai");

            let result = Grants.get_my_grants(context, user);

            expect.array<Text>(result, showText, equalText).equal([]);
          },
        );

        await test(
          "should return all resource server IDs for a user with multiple grants",
          func() : async () {
            let context = createMockContext();
            let user = Principal.fromText("bkyz2-fmaaa-aaaaa-qaaaq-cai");

            // Setup: Manually create grants for the user
            let grants_set = Map.fromIter<Text, Null>(Iter.fromArray([("rs_id_1", null), ("rs_id_2", null)]), thash);
            Map.set(context.user_grants, phash, user, grants_set);

            let result = Grants.get_my_grants(context, user);

            // The order of keys from a map is not guaranteed, but expect.array handles this.
            expect.array<Text>(result, showText, equalText).equal(["rs_id_1", "rs_id_2"]);
          },
        );
      },
    );

    // --- Tests for revoke_grant ---
    await suite(
      "revoke_grant",
      func() : async () {
        await test(
          "should remove a grant for the owner and return Ok",
          func() : async () {
            let context = createMockContext();
            let user = Principal.fromText("bkyz2-fmaaa-aaaaa-qaaaq-cai");

            // Setup: Give the user two grants
            let grants_set = Map.fromIter<Text, Null>(Iter.fromArray([("rs_to_revoke", null), ("rs_to_keep", null)]), thash);
            Map.set(context.user_grants, phash, user, grants_set);

            // Act: Revoke one of the grants
            let revoke_result = await Grants.revoke_grant(context, user, "rs_to_revoke");

            // Assert: The revoke call was successful
            expect.result<Text, Text>(revoke_result, showResult, equalResult).isOk();

            // Assert: Verify the state was mutated correctly
            let remaining_grants = Grants.get_my_grants(context, user);
            expect.array<Text>(remaining_grants, showText, equalText).equal(["rs_to_keep"]);
          },
        );

        await test(
          "should succeed even if the grant to revoke does not exist",
          func() : async () {
            let context = createMockContext();
            let user = Principal.fromText("bkyz2-fmaaa-aaaaa-qaaaq-cai");

            // Setup: User has one grant, but we will try to revoke a different one
            let grants_set = Map.fromIter<Text, Null>(Iter.fromArray([("rs_id_1", null)]), thash);
            Map.set(context.user_grants, phash, user, grants_set);

            // Act: Attempt to revoke a grant that doesn't exist
            let revoke_result = await Grants.revoke_grant(context, user, "rs_non_existent");

            // Assert: The call should still be successful
            expect.result<Text, Text>(revoke_result, showResult, equalResult).isOk();

            // Assert: The user's original grants should be unaffected
            let remaining_grants = Grants.get_my_grants(context, user);
            expect.array<Text>(remaining_grants, showText, equalText).equal(["rs_id_1"]);
          },
        );

        await test(
          "should not affect the grants of other users",
          func() : async () {
            let context = createMockContext();
            let user_A = Principal.fromText("bkyz2-fmaaa-aaaaa-qaaaq-cai");
            let user_B = Principal.fromText("5s2ji-faaaa-aaaaa-qaaaq-cai");

            // Setup: Give each user a grant
            let grants_A = Map.fromIter<Text, Null>(Iter.fromArray([("rs_for_A", null)]), thash);
            let grants_B = Map.fromIter<Text, Null>(Iter.fromArray([("rs_for_B", null)]), thash);
            Map.set(context.user_grants, phash, user_A, grants_A);
            Map.set(context.user_grants, phash, user_B, grants_B);

            // Act: User A revokes their grant
            ignore await Grants.revoke_grant(context, user_A, "rs_for_A");

            // Assert: User A's grants are gone
            let grants_for_A_after = Grants.get_my_grants(context, user_A);
            expect.array<Text>(grants_for_A_after, showText, equalText).equal([]);

            // Assert: User B's grants are still intact
            let grants_for_B_after = Grants.get_my_grants(context, user_B);
            expect.array<Text>(grants_for_B_after, showText, equalText).equal(["rs_for_B"]);
          },
        );
      },
    );
  },
);
