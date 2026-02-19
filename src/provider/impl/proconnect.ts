import axios from "axios";

import { type WellKnown } from "../../utils/well-known";
import { type Provider } from "../Provider";

const base = (testServer = false): Provider => ({
  getIssuer(pathname = "", params?: Record<string, string>): string {
    const baseUrl = testServer
      ? "https://fca.integ01.dev-agentconnect.fr/api/v2"
      : "https://app.agentconnect.gouv.fr";
    return `${baseUrl}/${pathname.replace(/^\//, "")}${params ? `?${new URLSearchParams(params).toString()}` : ""}`;
  },

  async getWellKnown(): Promise<WellKnown> {
    const providerWellKnown = await axios.get<WellKnown>(this.getIssuer(".well-known/openid-configuration"));

    return providerWellKnown.data;
  },
});

export const proconnect = base();
export const proconnecttest = base(true);