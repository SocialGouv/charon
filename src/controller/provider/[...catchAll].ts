import axios from "axios";

import { getCharonClients } from "../../client/client";
import { config } from "../../config";
import { getProvider } from "../../provider";
import { logServer } from "../../utils/logger";
import { wildcardToRegex } from "../../utils/wildcard";
import { type ProviderMiddleware } from "../type";

/**
 * Factory middleware to catch all routes called under a middleware path.
 *
 * This is the main logic of Charon.
 *
 * It will catch, validate, and forward request from a client to a provider depending of the config.
 *
 * Supports both authorization flows (redirect_uri) and OIDC logout flows (post_logout_redirect_uri).
 */
export const catchAllRoutes =
  (excludedPaths: string[]): ProviderMiddleware =>
  async (ctx, next) => {
    try {
      const pathname = ctx.state.path;
      const providerType = ctx.state.providerType;
      if (excludedPaths.some(path => pathname.startsWith(path))) {
        logServer("Middleware passthrough for excluded path", pathname, ctx.request.method);
        await next();
        return;
      }
      const method = ctx.request.method;
      const allParams = (
        method === "GET" ? ctx.request.query : ctx.request.body
      ) as Record<string, string>;

      // Detect OIDC logout flow by the presence of post_logout_redirect_uri
      const isLogout = "post_logout_redirect_uri" in allParams;

      // Extract the URI to validate: post_logout_redirect_uri for logout, redirect_uri for auth
      const clientUri = isLogout
        ? allParams.post_logout_redirect_uri
        : allParams.redirect_uri ?? ctx.session!.originalRedirectUri;

      const { redirect_uri: _ignoreRedirectUri, post_logout_redirect_uri: _ignorePostLogout, ...others } = allParams;

      const clients = getCharonClients();

      logServer("Middleware incoming request", pathname, method, ctx.session, {
        cookies: ctx.headers.cookie,
        authorization: ctx.header.authorization,
        clientUri,
        isLogout,
        clients,
        ...others,
      });

      for (const client of clients) {
        if (client.provider !== providerType) {
          continue;
        }
        const shouldPass = client.wildcards.some(wildcard => {
          const regex = wildcardToRegex(wildcard);
          return regex.test(clientUri);
        });
        logServer({ shouldPass, clientUri, isLogout });
        if (shouldPass) {
          const provider = getProvider(client.provider);

          // Store session for the callback to redirect back to the original URI
          ctx.session!.provider = client.provider;
          ctx.session!.client = client;
          ctx.session!.originalRedirectUri = clientUri;
          ctx.session!.params = others;

          // Build params for the provider:
          // - Auth flow: rewrite redirect_uri to Charon's /oauth/callback
          // - Logout flow: rewrite post_logout_redirect_uri to Charon's /oauth/logout-callback
          const params = isLogout
            ? {
                ...others,
                post_logout_redirect_uri: config.app.charonUrl("/oauth/logout-callback"),
              }
            : {
                ...others,
                redirect_uri: config.app.charonUrl("/oauth/callback"),
              };

          const headers: Record<string, string | string[]> = {};
          if (ctx.headers.authorization) {
            headers["Authorization"] = ctx.headers.authorization;
          }
          if (ctx.headers.accept) {
            headers["Accept"] = ctx.headers.accept;
          }
          if (ctx.headers["content-type"]) {
            headers["Content-Type"] = ctx.headers["content-type"];
          }

          if (method === "POST") {
            const redirectURL = provider.getIssuer(pathname);
            logServer("POST REDIRECT", { redirectURL, ctxsession: ctx.session, params, isLogout });
            const response = await axios.post<unknown>(redirectURL, params, {
              headers,
            });
            logServer("POST REDIRECT RESPONSE", response.status, response.statusText, response.data);
            ctx.status = response.status;
            ctx.body = response.data;
          } else if (method === "GET") {
            const redirectURL = provider.getIssuer(pathname, params);

            logServer("GET REDIRECT", { redirectURL, ctxsession: ctx.session, params, isLogout });

            Object.entries(headers).forEach(([key, value]) => {
              ctx.set(key, value);
            });
            ctx.redirect(redirectURL);
          }
        }
      }

      await next();
    } catch (error) {
      console.error("Error handling incoming requests:", error);
      ctx.throw(500, "Internal Server Error");
    }
  };
