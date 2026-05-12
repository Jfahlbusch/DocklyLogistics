import { dispatchEmail } from "./email";
import { dispatchApi } from "./api";
import { dispatchEdi } from "./edi";
import type { DispatchInput, DispatchResult } from "./types";

export async function dispatchOrder(input: DispatchInput): Promise<DispatchResult> {
  switch (input.order.supplier.channel) {
    case "EMAIL": return dispatchEmail(input);
    case "API":   return dispatchApi(input);
    case "EDI":   return dispatchEdi(input);
  }
}

export type { DispatchInput, DispatchResult };
