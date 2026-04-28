import type Router from "@koa/router";

import { logServer } from "../../utils/logger";

/**
 * OIDC RP-initiated logout callback. Hit by the upstream provider after
 * the user's IdP session cookie has been cleared. Reads the original
 * `post_logout_redirect_uri` from the session and redirects the browser
 * back to the originating client.
 *
 * Mirrors `oauthCallbackRoute` for the authorize flow.
 */
export const oauthLogoutCallbackRoute: Router.Middleware = ctx => {
  if (!ctx.session?.originalPostLogoutRedirectUri) {
    ctx.throw(400, "Logout session not found");
    return;
  }
  try {
    const originalPostLogoutRedirectUri = ctx.session.originalPostLogoutRedirectUri;
    const params = { ...ctx.query } as Record<string, string>;

    logServer("LOGOUT CALLBACK FROM OAuth provider", {
      cookie: ctx.request.headers.cookie,
      url: ctx.request.url,
      method: ctx.request.method,
      originalPostLogoutRedirectUri,
      params,
    });

    // Clear so a stale session can't redirect future logout-callbacks
    ctx.session.originalPostLogoutRedirectUri = undefined;

    const queryString = new URLSearchParams(params).toString();
    ctx.redirect(
      `${originalPostLogoutRedirectUri}${queryString ? `?${queryString}` : ""}`,
    );
  } catch (error) {
    console.error("Error handling OAuth logout callback:", error);
    ctx.throw(500, "Internal Server Error");
  }
};
