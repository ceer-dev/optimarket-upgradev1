/**
 * Analytics - Netlify Forms Tracker
 * Tracks user registrations, orders, and click events.
 * Only works when deployed on Netlify (fails silently on file://)
 */

const Analytics = {
  /**
   * Submit data to a Netlify Form silently via fetch.
   * @param {string} formName - The name of the Netlify form
   * @param {Object} data - Key/value pairs to submit
   */
  track: async function (formName, data) {
    try {
      const body = new URLSearchParams({
        "form-name": formName,
        timestamp: new Date().toISOString(),
        ...data,
      });

      // SKIP FETCH IF LOCAL (prevent CORS errors on file://)
      if (
        window.location.protocol === "file:" ||
        !window.location.host ||
        window.location.hostname === ""
      ) {
        console.debug("[Analytics] Skip (Local):", formName, data);
        return;
      }

      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    } catch (e) {
      // Fail silently — expected on local file:// environment
      console.debug(
        "[Analytics] Tracking skipped (local env):",
        formName,
        data,
      );
    }
  },

  /**
   * Track a user login/registration event.
   */
  trackLogin: function (user) {
    this.track("registro-visita", {
      nombre: user.name || "",
      celular: user.phone || "",
      nit: user.nit || "",
    });
  },

  /**
   * Track a completed order sent via WhatsApp.
   * @param {Object} user
   * @param {Array} cart
   * @param {string} paymentMethod
   */
  trackOrder: function (user, cart, paymentMethod) {
    const items = cart
      .map((i) => {
        const nombre = i.Subcategoria || i.nombre || "";
        return `${nombre} x${i.qty}`;
      })
      .join(" | ");

    const total = cart.reduce((sum, i) => {
      return sum + parseFloat(i.CF || i.cf || 0) * i.qty;
    }, 0);

    this.track("historial-pedido", {
      nombre: user.name || "",
      celular: user.phone || "",
      nit: user.nit || "",
      items: items,
      total: `${total.toFixed(2)} Bs.`,
      metodo_pago: paymentMethod,
    });
  },

  /**
   * Track a user action (click, search, etc.)
   * @param {string} action - Description of the action
   * @param {string} detail - Extra detail (e.g. category name)
   */
  trackAction: function (action, detail = "") {
    const user = window.Auth ? Auth.getUser() : null;
    this.track("auditoria-clicks", {
      nombre: user ? user.name : "Desconocido",
      celular: user ? user.phone : "",
      accion: action,
      detalle: detail,
    });
  },
};

window.Analytics = Analytics;
