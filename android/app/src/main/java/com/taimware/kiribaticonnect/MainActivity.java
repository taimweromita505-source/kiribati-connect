package com.taimware.kiribaticonnect;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.view.View;
import android.widget.*;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.android.billingclient.api.*;
import org.json.*;
import java.util.*;

public class MainActivity extends Activity implements PurchasesUpdatedListener {
 private static final String ORIGIN="https://kiribati-connect.taimweromita505.workers.dev";
 private static final Set<String> PRODUCTS=Set.of("listing_publish","kiri_monthly","kiri_yearly");
 private SwipeRefreshLayout swipe; private WebView web; private BillingClient billing; private ValueCallback<Uri[]> fileCallback;
 private final Map<String,ProductDetails> products=new HashMap<>();
 private boolean pageReady=false;
 @Override public void onCreate(Bundle saved){super.onCreate(saved);
  web=new WebView(this);web.setBackgroundColor(0xfff7f7ef);swipe=new SwipeRefreshLayout(this);swipe.setColorSchemeColors(0xff08665d);swipe.addView(web);swipe.setOnChildScrollUpCallback((parent,child)->web.getScrollY()>0);swipe.setOnRefreshListener(()->{web.reload();swipe.postDelayed(()->swipe.setRefreshing(false),8000);});setContentView(swipe);
  web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setDatabaseEnabled(true);settings.setCacheMode(WebSettings.LOAD_DEFAULT);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSafeBrowsingEnabled(true);settings.setUserAgentString(settings.getUserAgentString()+" KiribatiConnectAndroid/1.0");
  CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){Uri uri=request.getUrl();if(ORIGIN.equals(uri.getScheme()+"://"+uri.getHost()))return false;if(isPaymentHost(uri.getHost())){error("Use Google Play checkout in this app.");return true;}if(("https".equals(uri.getScheme())||"mailto".equals(uri.getScheme())||"tel".equals(uri.getScheme()))&&request.isForMainFrame()){try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){error("No app can open this link.");}}return true;}
   @Override public void onPageFinished(WebView view,String url){if(swipe!=null)swipe.setRefreshing(false);pageReady=url.startsWith(ORIGIN+"/");if(pageReady){catalog();restore();}}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError e){if(request.isForMainFrame()){LinearLayout box=new LinearLayout(MainActivity.this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(32,64,32,32);TextView text=new TextView(MainActivity.this);text.setText("Kiribati Connect\n\nCannot connect right now. Check your connection and try again.");Button retry=new Button(MainActivity.this);retry.setText("Try again");retry.setOnClickListener(v->{setContentView(swipe);web.loadUrl(ORIGIN+"/");});box.addView(text);box.addView(retry);setContentView(box);}}
  });
  web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("image/*");intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);try{startActivityForResult(intent,24);return true;}catch(Exception e){fileCallback=null;return false;}}});
  if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.addWebMessageListener(web,"KiribatiAndroid",Set.of(ORIGIN),(view,message,sourceOrigin,isMainFrame,reply)->{if(!isMainFrame||!ORIGIN.equals(sourceOrigin.toString()))return;try{JSONObject data=new JSONObject(message.getData());runOnUiThread(()->{switch(data.optString("type")){case "catalog":catalog();break;case "restore":restore();break;case "purchase":purchase(data);break;default:error("Unsupported app request.");}});}catch(Exception e){error("Invalid app request.");}});
  billing=BillingClient.newBuilder(this).setListener(this).enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()).enableAutoServiceReconnection().build();
  billing.startConnection(new BillingClientStateListener(){@Override public void onBillingSetupFinished(BillingResult result){if(result.getResponseCode()==BillingClient.BillingResponseCode.OK){catalog();restore();}else error("Google Play Billing is unavailable. Install from the Play testing link.");}@Override public void onBillingServiceDisconnected(){}});
  web.loadUrl(ORIGIN+"/");
 }
 private static boolean isPaymentHost(String h){if(h==null)return false;return h.equals("paypal.com")||h.endsWith(".paypal.com")||h.equals("square.link")||h.endsWith(".square.site");}
 private void emit(JSONObject data){runOnUiThread(()->{if(pageReady&&web.getUrl()!=null&&web.getUrl().startsWith(ORIGIN+"/"))web.evaluateJavascript("window.dispatchEvent(new CustomEvent('kc-native',{detail:"+data.toString()+"}));",null);});}
 private void error(String message){try{emit(new JSONObject().put("type","error").put("message",message));}catch(JSONException ignored){}}
 private void catalog(){if(billing==null||!billing.isReady())return;List<QueryProductDetailsParams.Product> list=new ArrayList<>();for(String id:PRODUCTS)list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(),(result,response)->{try{JSONObject prices=new JSONObject();products.clear();for(ProductDetails detail:response.getProductDetailsList()){products.put(detail.getProductId(),detail);List<ProductDetails.OneTimePurchaseOfferDetails> offers=detail.getOneTimePurchaseOfferDetailsList();if(offers!=null&&!offers.isEmpty())prices.put(detail.getProductId(),offers.get(0).getFormattedPrice());}emit(new JSONObject().put("type","catalog").put("prices",prices));}catch(Exception e){error("Products are not available yet.");}});}
 private void purchase(JSONObject data){if(!billing.isReady()){error("Google Play is not connected. Try again shortly.");return;}String id=data.optString("productId"),account=data.optString("accountId"),intent=data.optString("intentId");if(!PRODUCTS.contains(id)||!account.matches("[a-f0-9]{64}")||!intent.matches("[a-f0-9-]{36}")){error("Invalid purchase request.");return;}ProductDetails product=products.get(id);if(product==null){catalog();error("This product is not yet available on Google Play.");return;}List<ProductDetails.OneTimePurchaseOfferDetails> offers=product.getOneTimePurchaseOfferDetailsList();if(offers==null||offers.isEmpty()){error("Price unavailable.");return;}BillingFlowParams.ProductDetailsParams productParams=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offers.get(0).getOfferToken()).build();BillingResult result=billing.launchBillingFlow(this,BillingFlowParams.newBuilder().setProductDetailsParamsList(List.of(productParams)).setObfuscatedAccountId(account).setObfuscatedProfileId(intent).build());if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK)error("Google Play could not open checkout. No access was granted.");}
 private void restore(){if(billing==null||!billing.isReady()||!pageReady)return;billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),(result,purchases)->{if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)for(Purchase purchase:purchases)deliver(purchase);});}
 private void deliver(Purchase purchase){try{if(purchase.getPurchaseState()==Purchase.PurchaseState.PURCHASED)emit(new JSONObject().put("type","purchase").put("token",purchase.getPurchaseToken()));else if(purchase.getPurchaseState()==Purchase.PurchaseState.PENDING)error("Payment is pending. Access unlocks only after Google confirms payment.");}catch(Exception e){error("Could not check purchase.");}}
 @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases){if(result.getResponseCode()==BillingClient.BillingResponseCode.OK&&purchases!=null)for(Purchase p:purchases)deliver(p);else if(result.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED)error("Checkout cancelled.");else error("Purchase was not completed. Restore purchases to check its status.");}
 @Override protected void onResume(){super.onResume();restore();}
 @Override public void onBackPressed(){if(pageReady)web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true}return false})()",value->{if(!"true".equals(value)){if(web.canGoBack())web.goBack();else finish();}});else super.onBackPressed();}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==24&&fileCallback!=null){Uri[] values=WebChromeClient.FileChooserParams.parseResult(result,data);if(values!=null)for(Uri uri:values)if(!"content".equals(uri.getScheme())){values=null;break;}fileCallback.onReceiveValue(values);fileCallback=null;}}
 @Override protected void onDestroy(){if(billing!=null)billing.endConnection();web.destroy();super.onDestroy();}
}
