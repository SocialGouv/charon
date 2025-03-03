import { type CharonClient } from "../client/types";
import { type config } from "../config";
import { github } from "./impl/github";
import { moncomptepro, moncompteprotest } from "./impl/moncomptepro";
import { fabriqueKeycloak} from "./impl/fabrique-keycloak";
import { type Provider } from "./Provider";

export type ProviderType = (typeof config.providers)[number];

export const providers: Record<ProviderType, Provider> = {
  github,
  moncomptepro,
  moncompteprotest,
  fabriqueKeycloak,
};

export function getProvider(providerType: CharonClient["provider"]): Provider {
  const provider = providers[providerType];
  if (!provider) {
    throw new Error(`Provider "${providerType}" not found`);
  }
  return provider;
}
