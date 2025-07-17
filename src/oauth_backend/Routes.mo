import Server "server";
import Types "Types";
import DCR "oauth/DCR";
import WellKnown "oauth/WellKnown";
import Authorize "oauth/Authorize";
import Token "oauth/Token";

module {

  // Main registration function
  public func register(server : Server.Server, context : Types.Context) {

    // --- Authorization Endpoint ---
    server.get(
      "/authorize",
      func(req : Types.Request, res : Types.ResponseClass) : async Types.Response {
        await Authorize.handle_authorize(context, req, res);
      },
    );

    // --- Token Exchange ---
    server.post(
      "/token",
      func(req : Types.Request, res : Types.ResponseClass) : async Types.Response {
        await Token.handle_token(context, req, res);
      },
    );

    // --- Dynamic Client Registration ---
    server.post(
      "/register",
      func(req : Types.Request, res : Types.ResponseClass) : async Types.Response {
        await DCR.handle_request(context, req, res);
      },
    );

    // --- Server Discovery & Metadata ---
    server.get(
      "/.well-known/jwks.json",
      func(req : Types.Request, res : Types.ResponseClass) : async Types.Response {
        await WellKnown.handle_jwks(context, req, res);
      },
    );

    server.get(
      "/.well-known/oauth-authorization-server",
      func(req : Types.Request, res : Types.ResponseClass) : async Types.Response {
        await WellKnown.handle_metadata(context, req, res);
      },
    );
  };
};
