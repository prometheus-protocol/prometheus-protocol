import Types "Types";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Text "mo:base/Text";
import Array "mo:base/Array";

module {
  /**
   * Builds a structured list of scopes with their human-readable descriptions.
   * This function is responsible for parsing the scope string, looking up custom
   * scopes from the resource server's definitions, and providing descriptions
   * for built-in protocol scopes.
   * @param context The shared application context.
   * @param session The current authorization session.
   * @returns An array of `ScopeData` records for the UI.
   */
  public func build_scope_details(
    context : Types.Context,
    session : Types.AuthorizeSession,
  ) : [Types.ScopeData] {
    // 6a. Find the target resource server to get its scope definitions.
    var rs_scope_map : ?Map.Map<Text, Text> = null;

    switch (Map.get(context.resource_servers, thash, session.resource_server_id)) {
      case (null) {};
      case (?r) rs_scope_map := ?Map.fromIter<Text, Text>(r.scopes.vals(), thash);
    };

    // 6b. Build the structured list of scopes and their descriptions.
    var scope_details : [Types.ScopeData] = [];
    let requested_scopes = Text.split(session.scope, #char ' ');

    label buildScopeDetails for (scope in requested_scopes) {
      if (scope == "openid") {
        scope_details := Array.append<Types.ScopeData>(
          scope_details,
          [{
            id = "openid";
            description = "Confirm your identity with this application.";
          }],
        );
      } else if (scope == "prometheus:charge") {
        scope_details := Array.append<Types.ScopeData>(
          scope_details,
          [{
            id = "prometheus:charge";
            description = "Allow this application to charge your account.";
          }],
        );
      } else if (scope == "profile") {
        // Silently ignore the profile scope as we don't support it.
        continue buildScopeDetails;
      } else {
        // For all other scopes, look them up in the resource server's definitions.
        switch (rs_scope_map) {
          case (?map) {
            switch (Map.get(map, thash, scope)) {
              case (null) {
                // If the scope isn't found, it's a bug.
                continue buildScopeDetails;
              };
              case (?description) {
                scope_details := Array.append<Types.ScopeData>(
                  scope_details,
                  [{
                    id = scope;
                    description = description;
                  }],
                );
              };
            };
            // If a scope isn't found here, it's a bug, as validation should have caught it.
            // We safely ignore it to prevent crashes.
          };
          case (null) {
            /* No resource server, so no custom scopes to describe */
          };
        };
      };
    };

    return scope_details;
  };
};
