"use client";
// A <form> bound to a server action that returns { error } or { message }.
// Shows the result inline so every admin form gets feedback for free.

import { useActionState, type ReactNode } from "react";

export type ActionState = { error?: string; message?: string } | null;

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    // React 19 resets uncontrolled fields after the action completes.
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && <p className="mt-2 text-sm font-medium text-red-700">{state.error}</p>}
      {state?.message && <p className="mt-2 text-sm font-medium text-emerald-700">{state.message}</p>}
    </form>
  );
}
