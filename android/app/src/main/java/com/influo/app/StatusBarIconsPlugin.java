package com.influo.app;

import android.view.View;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Depuis Android 15/16 (targetSdk 35+), le système impose le mode
 * edge-to-edge et ignore StatusBar.setBackgroundColor /
 * setOverlaysWebView du plugin @capacitor/status-bar officiel — ces
 * appels JS ne font plus rien de fiable. La seule façon supportée de
 * contrôler la couleur des ICÔNES de la barre de statut (heure, batterie,
 * réseau) reste WindowInsetsControllerCompat.setAppearanceLightStatusBars,
 * côté natif. Ce petit plugin expose ça au JS.
 */
@CapacitorPlugin(name = "StatusBarIcons")
public class StatusBarIconsPlugin extends Plugin {

    @PluginMethod
    public void setLight(PluginCall call) {
        Boolean light = call.getBoolean("light", true);
        getActivity().runOnUiThread(() -> {
            View decorView = getActivity().getWindow().getDecorView();
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getActivity().getWindow(), decorView);
            // true = icônes SOMBRES (pour fond clair) ; false = icônes CLAIRES (pour fond sombre)
            controller.setAppearanceLightStatusBars(light);
            call.resolve();
        });
    }
}
