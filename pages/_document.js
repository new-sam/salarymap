import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon */}
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        {/* Font preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700;1,800;1,900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700;1,800;1,900&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://www.google.com" />
        {/* SEO defaults */}
        <meta name="theme-color" content="#0c0c0b" />
        <meta property="og:locale" content="en_US" />
        {/* Google Analytics 4 — defer to not block render */}
        <script defer src="https://www.googletagmanager.com/gtag/js?id=G-XK0DH7FKDX" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XK0DH7FKDX');
        `}} />
        {/* Meta Pixel */}
        <script dangerouslySetInnerHTML={{ __html: `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '865110215480975');
          fbq('track', 'PageView');
        `}} />
        <noscript><img height="1" width="1" style={{display:'none'}} src="https://www.facebook.com/tr?id=865110215480975&ev=PageView&noscript=1" /></noscript>
        {/* Microsoft Clarity */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "wgl8tr69os");
        `}} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
