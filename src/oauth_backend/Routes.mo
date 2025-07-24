import Server "server";
import DCR "oauth/DCR";
import WellKnown "oauth/WellKnown";
import Authorize "oauth/Authorize";
import Token "oauth/Token";
import Types "oauth/Types";

module {

  // Main registration function
  public func register(server : Server.Server, context : Types.Context) {

    // --- Authorization Endpoint ---
    server.get(
      "/authorize",
      func(req : Server.Request, res : Server.ResponseClass) : async Server.Response {
        await Authorize.handle_authorize(context, req, res);
      },
    );

    // --- Token Exchange ---
    server.post(
      "/token",
      func(req : Server.Request, res : Server.ResponseClass) : async Server.Response {
        await Token.handle_token(context, req, res);
      },
    );

    // --- Dynamic Client Registration ---
    server.post(
      "/register",
      func(req : Server.Request, res : Server.ResponseClass) : async Server.Response {
        await DCR.handle_request(context, req, res);
      },
    );

    // --- Server Discovery & Metadata ---
    server.get(
      "/.well-known/jwks.json",
      func(req : Server.Request, res : Server.ResponseClass) : async Server.Response {
        WellKnown.handle_jwks(context, req, res);
      },
    );

    server.get(
      "/.well-known/oauth-authorization-server",
      func(req : Server.Request, res : Server.ResponseClass) : async Server.Response {
        WellKnown.handle_metadata(context, req, res);
      },
    );

    // --- Health Check ---
    server.get(
      "/health",
      func(_ : Server.Request, res : Server.ResponseClass) : async Server.Response {
        return WellKnown.handle_health_check(res);
      },
    );
  };
};
