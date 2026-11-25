"use server";

import { requestSignInCode } from "@/lib/app/code-request";
import type { LoginState } from "@/lib/app/sign-in-code";

/** Step 1 of the onboarding account screen: a new address gets an account on the spot, then the code by email. */
export async function requestSignupCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  return requestSignInCode("signup", prev, formData);
}
