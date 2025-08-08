import { test } "mo:test/async";
import McpRegistry "../src/main";

actor {

  public func runTests() : async () {
    // deploy your canister
    let myCanister = await (with cycles = 1_000_000_000_000) McpRegistry.ICRC118WasmRegistryCanister(null);
    await test(
      "hello world",
      func() : async () {
        let res = await myCanister.hello();
        assert res == "world!";
      },
    );
  };
};
