package com.influo.app;

import android.graphics.Color;
import android.view.View;
import android.view.Window;
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
 * côté natif. Ce plugin expose ça au JS, plus la couleur de fond via
 * Window.setStatusBarColor (toujours fonctionnelle en edge-to-edge tant
 * que l'app ne force pas setDecorFitsSystemWindows(false) sans la gérer).
 */
@CapacitorPlugin(name = "StatusBarIcons")
public class StatusBarIconsPlugin extends Plugin {

    @PluginMethod
    public void setLight(PluginCall call) {
        Boolean light = call.getBoolean("light", true);
        String backgroundColor = call.getString("backgroundColor");

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            View decorView = window.getDecorView();
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, decorView);
            // true = icônes SOMBRES (pour fond clair) ; false = icônes CLAIRES (pour fond sombre)
            controller.setAppearanceLightStatusBars(light);

            if (backgroundColor != null) {
                try {
                    window.setStatusBarColor(Color.parseColor(backgroundColor));
                } catch (IllegalArgumentException ignored) {
                    // couleur invalide, on laisse la couleur actuelle
                }
            }

            call.resolve();
        });
    }
}
