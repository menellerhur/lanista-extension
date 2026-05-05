// Notification logger — handles session-based in-memory logging and display.
// Depends on: common/page-navigation.js (getNotificationsLink, hideCustomPage, getExtensionLink, getDatabaseLink)

(function() {
  let _notificationsLog = [];

  // Listen for relayed notifications from the internal Vue bus (What the user actually sees)
  window.addEventListener("ext:notification-bus", e => {
    // Only log if the feature is enabled in settings
    if (!document.body.classList.contains("ext-s-show-notifications-log")) return;

    const payload = e.detail;
    if (!payload || !payload.message) return;

    const message = payload.message.replace(/<[^>]*>/g, '').trim();

    _logNotification({
        eventName: "Notifikation",
        payload: payload,
        text: message,
        category: payload.danger ? "Varning" : (payload.success ? "Privat" : "Global")
    });
  });

  function _logNotification({ eventName, payload, text, category }) {
    const entry = {
      _rawTimestamp: Date.now(),
      timestamp: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text: text,
      category: category,
      eventName: eventName,
      data: payload
    };

    _notificationsLog.unshift(entry);

    const panel = document.getElementById("ext-panel");
    if (panel && panel.dataset.extPage === "notifications") {
      renderNotificationsList();
    }
  }

  window.showNotificationsPage = async function() {
    const existing = document.getElementById("ext-panel");
    if (existing) {
      if (existing.dataset.extPage === "notifications") return;
      existing.remove();
      const c = document.querySelector(".content");
      if (c) c.style.display = "";
      getExtensionLink()?.classList.remove("sidebar-nav-link-active");
      getDatabaseLink()?.classList.remove("sidebar-nav-link-active");
    }

    const content = document.querySelector(".content");
    if (!content) return;

    document.querySelectorAll(".sidebar-nav-link-active").forEach(el => el.classList.remove("sidebar-nav-link-active"));
    document.querySelectorAll(".router-link-active").forEach(el => el.classList.remove("router-link-active"));
    document.querySelectorAll(".router-link-exact-active").forEach(el => el.classList.remove("router-link-exact-active"));
    getNotificationsLink()?.classList.add("sidebar-nav-link-active");

    if (window.location.hash !== "#notifications") {
      extRouterPush("/game/arena#notifications");
    }

    document.title = "Notifikationer | Lanista";

    const panel = document.createElement("div");
    panel.id = "ext-panel";
    panel.dataset.extPage = "notifications";
    panel.className = content.className;
    panel.innerHTML = `
      <div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-0 border border-border shadow-xl surface-card relative rounded-xl p-4 lg:p-5">
        <h2 class="block font-serif uppercase text-foreground leading-tight">Notifikationer</h2>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left text-sm border-collapse">
            <thead>
              <tr class="border-b border-border">
                <th class="py-1 px-3 font-semibold text-foreground/70 w-24">Tid</th>
                <th class="py-1 px-3 font-semibold text-foreground/70">Meddelande</th>
              </tr>
            </thead>
            <tbody id="ext-notifications-body"></tbody>
          </table>
          <div id="ext-notifications-empty" class="py-10 text-center text-foreground/40 hidden">
            Inga notifikationer loggade för denna session.
          </div>
        </div>
      </div>
    `;

    content.style.display = "none";
    content.parentNode.insertBefore(panel, content);

    renderNotificationsList();
  };

  function renderNotificationsList() {
    const body = document.getElementById("ext-notifications-body");
    const empty = document.getElementById("ext-notifications-empty");
    if (!body || !empty) return;

    if (_notificationsLog.length === 0) {
      body.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");
    body.innerHTML = _notificationsLog.map(n => `
      <tr class="border-b border-border/50 hover:bg-foreground/5 transition-colors">
        <td class="py-1 px-3 text-foreground/60 tabular-nums whitespace-nowrap">${n.timestamp}</td>
        <td class="py-1 px-3 text-foreground/90 max-w-0 w-full">
          <div class="font-medium whitespace-nowrap overflow-x-auto scrollbar-none">${n.text}</div>
        </td>
      </tr>
    `).join("");
  }
})();
