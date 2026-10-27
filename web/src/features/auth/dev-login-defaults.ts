export interface LoginDefaults {
  username: string;
  password: string;
}

const EMPTY: LoginDefaults = { username: '', password: '' };

/**
 * Dev-only prefill of the login form (owner request 27/10): both values come from `VITE_DEV_LOGIN_USERNAME` and
 * `VITE_DEV_LOGIN_PASSWORD` in the git-ignored `web/.env.local`, and apply only in a dev server with both set.
 */
export const devLoginDefaults = (isDev: boolean, username: string | undefined, password: string | undefined): LoginDefaults =>
  isDev && username?.trim() && password ? { username: username.trim(), password } : EMPTY;

/**
 * The env reads stay behind the `DEV` constant so a production build folds them away and never embeds the values
 * (checked with `npm run build` + grep of `dist`).
 */
export const loginDefaults = (): LoginDefaults =>
  import.meta.env.DEV ? devLoginDefaults(true, import.meta.env.VITE_DEV_LOGIN_USERNAME, import.meta.env.VITE_DEV_LOGIN_PASSWORD) : EMPTY;
