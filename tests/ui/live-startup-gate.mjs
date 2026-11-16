// Pure checks for the read-only public Firebase Hosting startup probe.
export function liveStartupFailures({ pageStatus, title, mainScriptCount, rootChildren, htmlBoot, loaderCount }) {
  const failures = [];
  if (pageStatus !== 200) failures.push(`Expected HTTP 200; got ${pageStatus ?? 'no response'}`);
  if (title === 'Site Not Found') failures.push('Firebase is serving its Site Not Found page');
  if (!(mainScriptCount > 0)) failures.push('No application module script in served HTML');
  if (!(rootChildren > 0)) failures.push('Application root is empty or missing');
  if (htmlBoot || loaderCount > 0) failures.push('Application still displaying loading placeholder');
  return failures;
}
