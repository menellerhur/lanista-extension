// Runs in MAIN world — intercepts the game's internal Vue event bus ($bt)
// to capture all notifications shown to the user.
(async function() {
    if (window.__lanistaExtBusListener) return;
    window.__lanistaExtBusListener = true;

    try {
        const ctx = await window.LanistaApp.getAppContext();
        if (!ctx) return;
        const bus = ctx.getBus();
        
        if (!bus) {
            console.warn("[Lanista-Ext] Bus listener: Event bus not found in game exports.");
            return;
        }

        const originalEmit = bus.$emit;
        bus.$emit = function(event, payload) {
            if (event === "global-notification") {
                // Relay exactly what's being shown to the user.
                window.dispatchEvent(new CustomEvent("ext:notification-bus", { detail: payload }));
            }
            return originalEmit.apply(this, arguments);
        };
        

    } catch (err) {
        console.error("[Lanista-Ext] Bus listener failed:", err);
    }
})();
