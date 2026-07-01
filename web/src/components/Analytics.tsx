import Script from 'next/script';

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const PLAUSIBLE_SRC =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.outbound-links.js';
const USE_PLAUSIBLE_INIT = PLAUSIBLE_SRC.includes('/js/pa-');

export default function Analytics() {
  if (!PLAUSIBLE_DOMAIN && !USE_PLAUSIBLE_INIT) return null;

  return (
    <>
      <Script
        async
        data-domain={USE_PLAUSIBLE_INIT ? undefined : PLAUSIBLE_DOMAIN}
        src={PLAUSIBLE_SRC}
        strategy="afterInteractive"
      />
      {USE_PLAUSIBLE_INIT ? (
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
plausible.init()`}
        </Script>
      ) : null}
    </>
  );
}
