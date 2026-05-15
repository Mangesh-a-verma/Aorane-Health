import re

with open('artifacts/aorane-mobile/app/wearable.tsx', 'r') as f:
    content = f.read()

# Fix getHC:
# we need to make sure that getHC handles things gracefully.
getHC_replacement = """function getHC(): HCModule | null {
  if (_hcAttempted) return _hc;
  _hcAttempted = true;
  try {
    const nativeBridge =
      NativeModules.HealthConnect ??
      NativeModules.RNHealthConnect ??
      NativeModules.ReactNativeHealthConnect;
    if (!nativeBridge) {
      _hc = null;
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-health-connect");

    // Instead of directly using mod methods, we wrap them to ensure they catch everything
    if (mod) {
        _hc = {
            initialize: async () => {
                try { return typeof mod.initialize === 'function' ? await mod.initialize() : false; } catch { return false; }
            },
            requestPermission: async (perms) => {
                try { return typeof mod.requestPermission === 'function' ? await mod.requestPermission(perms) : []; } catch { return []; }
            },
            readRecords: async (type, opts) => {
                try { return typeof mod.readRecords === 'function' ? await mod.readRecords(type, opts) : { records: [] }; } catch { return { records: [] }; }
            },
            getSdkStatus: async () => {
                try { return typeof mod.getSdkStatus === 'function' ? await mod.getSdkStatus() : 1; } catch { return 1; }
            },
            SdkAvailabilityStatus: mod.SdkAvailabilityStatus || { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 }
        };
    } else {
        _hc = null;
    }
    return _hc;
  } catch (err) {
    console.log("Health Connect Initialization Error:", err);
    _hc = null;
    return null;
  }
}"""

content = re.sub(
    r"function getHC\(\): HCModule \| null \{.*?return null;\n  \}\n\}",
    getHC_replacement,
    content,
    flags=re.DOTALL
)

with open('artifacts/aorane-mobile/app/wearable.tsx', 'w') as f:
    f.write(content)
