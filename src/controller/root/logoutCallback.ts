import { createCallbackRoute } from "./callbackFactory";

/**
 * Handle post-logout callback from OIDC provider.
 *
 * After the provider clears its session, it redirects the browser here
 * with the `state` query param. Charon then redirects back to the
 * original client application URL stored in session.
 */
export const logoutCallbackRoute = createCallbackRoute("logout");
