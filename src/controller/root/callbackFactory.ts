import type Router from "@koa/router";

import { logServer } from "../../utils/logger";

/**
 * Create a callback route handler for OAuth or OIDC logout flows.
 *
 * Both auth and logout callbacks follow the same pattern:
 * 1. Check session exists (set by catch-all during the initial request)
 * 2. Retrieve the original client URI from session
 * 3. Redirect back to the client with query params from the provider
 */
export const createCallbackRoute = (label: string): Router.Middleware => ctx => {
  if (!ctx.session?.client) {
    ctx.throw(400, "Session not found");
    return;
  }
  try {
    const client = ctx.session.client;
    const originalRedirectUri = ctx.session.originalRedirectUri;
    const params = { ...ctx.query } as Record<string, string>;

    logServer(`CALLBACK FROM provider (${label})`, {
      cookie: ctx.request.headers.cookie,
      url: ctx.request.url,
      method: ctx.request.method,
      client,
      originalRedirectUri,
      params,
    });

    ctx.redirect(`${originalRedirectUri}?${new URLSearchParams(params).toString()}`);
  } catch (error) {
    console.error(`Error handling ${label} callback:`, error);
    ctx.throw(500, "Internal Server Error");
  }
};
