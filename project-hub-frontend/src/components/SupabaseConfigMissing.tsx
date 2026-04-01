/**
 * Shown on Vercel (production) when Supabase env vars were not set at build time.
 */
export default function SupabaseConfigMissing() {
  return (
    <div className="config-missing">
      <h1>Configuration required</h1>
      <p>
        This app needs Supabase credentials. In your Vercel project, open{' '}
        <strong>Settings → Environment Variables</strong> and add:
      </p>
      <ul>
        <li>
          <code>VITE_SUPABASE_URL</code> — from Supabase <strong>Project Settings → API → Project URL</strong>
        </li>
        <li>
          <code>VITE_SUPABASE_ANON_KEY</code> — the <strong>anon public</strong> key (same page)
        </li>
      </ul>
      <p>
        Add them for <strong>Production</strong> (and <strong>Preview</strong> if you use preview deployments).
        Then trigger a <strong>new deployment</strong> so Vite can embed the values in the build.
      </p>
      <p className="config-missing-note">
        Do not use the database connection string or the <code>service_role</code> key in the frontend.
      </p>
    </div>
  );
}
