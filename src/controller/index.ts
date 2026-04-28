import Router from "@koa/router";
import type Koa from "koa";

import { config } from "../config";
import { catchAllRoutes } from "./provider/[...catchAll]";
import { prepareProviderRoutes } from "./provider/prepare";
import { sessionEndRoute } from "./provider/session-end";
import { wellKnownRoute } from "./provider/well-known";
import { healthcheckRoute } from "./root/healthcheck";
import { landingPage } from "./root/landing";
import { oauthCallbackRoute } from "./root/oauthCallback";
import { oauthLogoutCallbackRoute } from "./root/oauthLogoutCallback";
import { type ProviderRouterState } from "./type";

// OIDC end_session_endpoint paths used by the upstream providers we know
// about today:
//   - agent-connect (current ProConnect via /api/v2)  → /session/end
//   - proconnect-identite (panva/oidc-provider based) → /oauth/logout
// The path that actually reaches us depends on what each provider's
// well-known doc declares. Registering both routes against the same
// handler keeps charon forward-compatible without per-provider wiring.
const SESSION_END_PATHS = ["/session/end", "/oauth/logout"] as const;

export const controller = (app: Koa) => {
  const providerRouter = new Router<ProviderRouterState>();
  providerRouter.use(prepareProviderRoutes);
  providerRouter.get("/.well-known/openid-configuration", wellKnownRoute);
  for (const path of SESSION_END_PATHS) {
    providerRouter.all(path, sessionEndRoute);
  }
  providerRouter.all(
    "/(.+)",
    catchAllRoutes([
      "/.well-known/openid-configuration",
      ...SESSION_END_PATHS,
    ]),
  );

  const router = new Router();
  router.use((ctx, next) => {
    ctx.set("X-Powered-By", "Charon");
    ctx.set("X-Charon-Version", config.app.version);

    return next();
  });
  router.get("/oauth/callback", oauthCallbackRoute);
  router.get("/oauth/logout/callback", oauthLogoutCallbackRoute);
  router.get("/", landingPage);
  router.all(config.app.healthcheck.path, healthcheckRoute);

  router.use(
    config.providers.map(providerType => `/${providerType}`),
    providerRouter.routes(),
    providerRouter.allowedMethods(),
  );

  app.use(router.routes());
  app.use(router.allowedMethods());
};
