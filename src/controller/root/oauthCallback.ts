import { createCallbackRoute } from "./callbackFactory";

/**
 * Handle callback for OAuth provider. Depends on cookie as it
 * should be the end of the "browser redirection" flow handled by Charon
 */
export const oauthCallbackRoute = createCallbackRoute("OAuth");
