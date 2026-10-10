/**
 * Which kind of host is the app running on?
 * - Main Tabverse hosts (tabverse.in, www/app.tabverse.in, localhost) show the landing page and admin.
 * - Anything else is a restaurant website: name.tabverse.in, a restaurant's own domain
 *   (www.spicegarden.in), or name.localhost / www.name.localhost in local development.
 */
const MAIN_HOSTS = new Set(['localhost', '127.0.0.1', 'tabverse.in', 'www.tabverse.in', 'app.tabverse.in']);

export function isTenantHost(hostname: string = window.location.hostname): boolean {
  const host = hostname.toLowerCase();
  if (MAIN_HOSTS.has(host)) return false;
  if (host.endsWith('.azurewebsites.net')) return false; // Azure default hostname of the app itself
  return true;
}
