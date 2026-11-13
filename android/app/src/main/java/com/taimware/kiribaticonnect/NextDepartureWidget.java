package com.taimware.kiribaticonnect;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Home screen widget: next boat departure and latest job. Data is the public feed; cached for offline. */
public class NextDepartureWidget extends AppWidgetProvider {
  private static final String ORIGIN = "https://kiribaticonnect.app";

  @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    final PendingResult pending = goAsync();
    new Thread(() -> {
      try {
        SharedPreferences prefs = context.getSharedPreferences("widget", Context.MODE_PRIVATE);
        String boat = prefs.getString("boat", "Open the app to load boats");
        String job = prefs.getString("job", "Open the app to load jobs");
        try {
          JSONArray notices = fetch();
          String[] result = summarise(notices);
          if (result[0] != null) boat = result[0];
          else boat = "No upcoming boats listed";
          if (result[1] != null) job = result[1];
          else job = "No open jobs listed";
          prefs.edit().putString("boat", boat).putString("job", job).apply();
        } catch (Exception offline) {
          // Keep the last cached values when offline.
        }
        for (int id : ids) {
          RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_next);
          views.setTextViewText(R.id.widget_boat, boat);
          views.setTextViewText(R.id.widget_job, job);
          Intent open = new Intent(context, MainActivity.class);
          open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
          views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
          manager.updateAppWidget(id, views);
        }
      } finally {
        pending.finish();
      }
    }).start();
  }

  private static JSONArray fetch() throws Exception {
    HttpURLConnection connection = (HttpURLConnection) new URL(ORIGIN + "/api/notices").openConnection();
    connection.setConnectTimeout(8000);
    connection.setReadTimeout(8000);
    connection.setRequestProperty("User-Agent", "KiribatiConnectAndroid/1.0 widget");
    try (InputStream in = connection.getInputStream()) {
      java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
      byte[] buffer = new byte[8192];
      int n;
      while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
      return new JSONObject(out.toString("UTF-8")).getJSONArray("notices");
    } finally {
      connection.disconnect();
    }
  }

  static String[] summarise(JSONArray notices) {
    String boat = null, job = null;
    long bestTime = Long.MAX_VALUE, now = System.currentTimeMillis();
    for (int i = 0; i < notices.length(); i++) {
      JSONObject item = notices.optJSONObject(i);
      if (item == null) continue;
      String category = item.optString("category");
      JSONObject details = item.optJSONObject("details");
      boolean isTransport = "Boats".equals(category) || "Ships".equals(category) || "Flights".equals(category);
      if (isTransport && details != null && !"cancelled".equals(details.optString("boatStatus"))) {
        try {
          int offset = details.optInt("utcOffset", 12);
          long when = LocalDateTime.parse(details.optString("departureLocal")).toInstant(ZoneOffset.ofHours(offset)).toEpochMilli();
          if (when > now && when < bestTime) {
            bestTime = when;
            String icon = "Flights".equals(category) ? "\u2708\uFE0F " : "Ships".equals(category) ? "\uD83D\uDEA2 " : "\u26F5 ";
            boat = icon + item.optString("island") + " \u2192 " + details.optString("destinationIsland") + " \u00B7 " + details.optString("departureLocal").replace('T', ' ');
          }
        } catch (Exception ignored) { }
      } else if ("Jobs".equals(category) && job == null) {
        job = item.optString("title") + " \u00B7 " + item.optString("island");
      }
    }
    return new String[] { boat, job };
  }
}
