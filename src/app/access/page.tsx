import { unlock } from "@/app/actions/access";
import { ActionForm } from "@/components/action-form";

export default async function Access({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight">TimeClock</h1>
        <p className="mt-1 mb-4 text-sm text-stone-500">Sign in to the demo environment.</p>
        <ActionForm action={unlock} className="space-y-3">
          {next && <input type="hidden" name="next" value={next} />}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" className="input" required />
          </div>
          <button className="btn-primary w-full">Sign in</button>
        </ActionForm>
      </div>
    </main>
  );
}
