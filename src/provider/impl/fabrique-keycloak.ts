import axios from "axios";

import { type WellKnown } from "../../utils/well-known";
import { type Provider } from "../Provider";

export const fabriqueKeycloak: Provider = {
  getIssuer(pathname = "", params?: Record<string, string>): string {
    const baseUrl = "https://keycloak.undercloud.fabrique.social.gouv.fr/realms/atlas";
    return `${baseUrl}/${pathname.replace(/^\//, "")}${params ? `?${new URLSearchParams(params).toString()}` : ""}`;
  },

  async getWellKnown(): Promise<WellKnown> {
    const providerWellKnown = await axios.get<WellKnown>(this.getIssuer(".well-known/openid-configuration"));

    return providerWellKnown.data;
  },
};
