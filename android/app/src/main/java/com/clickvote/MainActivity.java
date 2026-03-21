package com.clickvote;

import android.os.Bundle;
import com.clickvote.plugins.ThermalPrinterPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(ThermalPrinterPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
