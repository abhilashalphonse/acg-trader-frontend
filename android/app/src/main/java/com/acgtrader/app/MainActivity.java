package com.acgtrader.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

/**
 * Native production trading app. Keep refresh credentials HttpOnly inside
 * WebView's cookie jar; never store passwords or refresh tokens in JavaScript.
 * Server session revocation and account permissions stay authoritative.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    CookieManager cookies = CookieManager.getInstance();
    cookies.setAcceptCookie(true);
    // The packaged assets have the first-party HTTPS app origin, while the
    // existing trader backend issues a Secure/SameSite=None refresh cookie.
    // Android WebView otherwise blocks it as a third-party credential.
    cookies.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
  }
}
