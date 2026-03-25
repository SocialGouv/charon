import type Router from "@koa/router";

import { logServer } from "../../utils/logger";

/**
 * Handle post-logout callback from OIDC provider.
 *
 * After the provider clears its session, it redirects the browser here
 * with the `state` query param. Charon then redirects back to the
 * original client application URL stored in session.
 */
export const logoutCallbackRoute: Router.Middleware = ctx => {
  if (!ctx.session?.client) {
    ctx.throw(400, "Session not found");
    return;
  }
  try {
    const client = ctx.session.client;
    const originalRedirectUri = ctx.session.originalRedirectUri;
    const params = { ...ctx.query } as Record<string, string>;

    logServer("CALLBACK FROM OIDC provider (logout)", {
      cookie: ctx.request.headers.cookie,
      url: ctx.request.url,
      method: ctx.request.method,
      client,
      originalRedirectUri,
      params,
    });

    ctx.redirect(`${originalRedirectUri}?${new URLSearchParams(params).toString()}`);
  } catch (error) {
    console.error("Error handling logout callback:", error);
    ctx.throw(500, "Internal Server Error");
  }
};
