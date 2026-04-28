import { getCharonClients } from "../../client/client";
import { config } from "../../config";
import { getProvider } from "../../provider";
import { logServer } from "../../utils/logger";
import { wildcardToRegex } from "../../utils/wildcard";
import { type ProviderMiddleware } from "../type";

/**
 * Handle OIDC RP-initiated logout (`/{provider}/session/end`).
 *
 * Mirrors the dispatch logic of the catchAll handler but matches against
 * `post_logout_redirect_uri` instead of `redirect_uri`. When a registered
 * wildcard matches, we rewrite the URI to charon's own logout callback and
 * stash the original in the session — same trick as for authorize callbacks,
 * applied to the logout path.
 *
 * Without this handler the IdP session cookie can never be cleared from a
 * dynamic-URL client (review apps): the upstream IdP refuses any
 * `post_logout_redirect_uri` it has not seen registered, and we do not
 * register every per-PR URL.
 *
 * If `post_logout_redirect_uri` is absent the request is just forwarded
 * to the upstream — the user lands on the provider's default "logged out"
 * page.
 */
export const sessionEndRoute: ProviderMiddleware = async (ctx, next) => {
  try {
    const pathname = ctx.state.path;
    const providerType = ctx.state.providerType;
    const method = ctx.request.method;
    const {
      post_logout_redirect_uri = ctx.session?.originalPostLogoutRedirectUri,
      ...others
    } = (method === "GET" ? ctx.request.query : ctx.request.body) as Record<
      string,
      string
    >;

    logServer("Session-end incoming", pathname, method, ctx.session, {
      cookies: ctx.headers.cookie,
      post_logout_redirect_uri,
      ...others,
    });

    const provider = getProvider(providerType);
    const params: Record<string, string> = { ...others };

    if (post_logout_redirect_uri) {
      const matchingClient = getCharonClients().find(
        client =>
          client.provider === providerType &&
          client.wildcards.some(wildcard =>
            wildcardToRegex(wildcard).test(post_logout_redirect_uri),
          ),
      );
      if (!matchingClient) {
        logServer("No client wildcard matches post_logout_redirect_uri", {
          post_logout_redirect_uri,
        });
        await next();
        return;
      }
      ctx.session!.provider = matchingClient.provider;
      ctx.session!.client = matchingClient;
      ctx.session!.originalPostLogoutRedirectUri = post_logout_redirect_uri;
      params.post_logout_redirect_uri = config.app.charonUrl(
        "/oauth/logout/callback",
      );
    }

    const redirectURL = provider.getIssuer(pathname, params);
    logServer("Session-end redirect", { redirectURL });
    ctx.redirect(redirectURL);
  } catch (error) {
    console.error("Error handling session-end:", error);
    ctx.throw(500, "Internal Server Error");
  }
};
