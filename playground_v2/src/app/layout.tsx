import newrelic from "newrelic";
import Script from "next/script";
import "./globals.css";
import { metadata } from "./metadata";
import Root from "./Root";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (newrelic.agent.collector.isConnected() === false) {
    await new Promise((resolve) => {
      newrelic.agent.on("connected", resolve);
    });
  }

  const browserTimingHeader = newrelic.getBrowserTimingHeader({
    hasToRemoveScriptWrapper: true,
    allowTransactionlessInjection: true,
  });

  return (
    <html lang="en">
      <Root>{children}</Root>
      <Script
        // We have to set an id for inline scripts.
        // See https://nextjs.org/docs/app/building-your-application/optimizing/scripts#inline-scripts
        id="nr-browser-agent"
        // By setting the strategy to "beforeInteractive" we guarantee that
        // the script will be added to the document's `head` element.
        strategy="beforeInteractive"
        // The body of the script element comes from the async evaluation
        // of `getInitialProps`. We use the special
        // `dangerouslySetInnerHTML` to provide that element body. Since
        // it requires an object with an `__html` property, we pass in an
        // object literal.
        dangerouslySetInnerHTML={{ __html: browserTimingHeader }}
      />
    </html>
  );
}

export { metadata };
