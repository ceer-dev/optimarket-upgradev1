/**
 * Cotizacion Logic
 * Handles Category Selection, Search, Cart Management.
 * Depends on: data.js, auth.js, ui.js
 */

let masterData = [];
window.cart = [];
let currentCategory = "Lentilla";
let currentSubCategory = "";
let paymentMethod = "QR"; // Default payment method

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Auth check is already done in HTML script, but double check safety
  if (!Auth.check()) return;

  loadMasterData();
  setupEventListeners();

  // Initialize with first category
  selectCategory("Lentilla");
});

async function loadMasterData() {
  // Show loading state
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Cargando datos...`;
  }

  try {
    // Try to use the local data.js first (for file:// protocol / local dev)
    if (typeof localMasterData !== "undefined") {
      masterData = localMasterData;
      console.log("Datos cargados desde local JS:", masterData.length);
    } else {
      // On Netlify / HTTP server: fetch the JSON directly
      // precios.json is at root, views/cotizacion.html is in /views/
      const response = await fetch("../precios.json");
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      masterData = await response.json();
      console.log("Datos cargados desde JSON:", masterData.length);
    }
  } catch (err) {
    console.error("Error loading data:", err);
    if (window.UI)
      UI.showToast("Error al cargar datos. Recarga la página.", "error");
  } finally {
    // Restore search button
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.innerHTML = `<i class="fas fa-search"></i> Buscar`;
    }

    // Refresh cart UI if items exist
    if (typeof updateFloatingCart === "function") updateFloatingCart();
  }
}

// --- Category & Form Logic ---
function setupEventListeners() {
  // Category Buttons
  const cats = ["Lentilla", "Material Listo", "Block", "Montura"];
  cats.forEach((cat) => {
    const btn = document.getElementById(`btn-${cat}`);
    if (btn) btn.addEventListener("click", () => selectCategory(cat));
  });

  // Search Button
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) searchBtn.addEventListener("click", performSearch);

  // WhatsApp Button
  const waBtn = document.getElementById("whatsappBtn");
  if (waBtn) waBtn.addEventListener("click", generateWhatsApp);

  // Payment Method Buttons
  const paymentQR = document.getElementById("paymentQR");
  const paymentEfectivo = document.getElementById("paymentEfectivo");

  if (paymentQR) {
    paymentQR.addEventListener("click", () => {
      paymentMethod = "QR";
      document
        .querySelectorAll(".payment-btn")
        .forEach((btn) => btn.classList.remove("active"));
      paymentQR.classList.add("active");
    });
  }

  if (paymentEfectivo) {
    paymentEfectivo.addEventListener("click", () => {
      paymentMethod = "EFECTIVO";
      document
        .querySelectorAll(".payment-btn")
        .forEach((btn) => btn.classList.remove("active"));
      paymentEfectivo.classList.add("active");
    });
  }

  // Enter key support for search (Delegation)
  const dynamicForm = document.getElementById("dynamicForm");
  if (dynamicForm) {
    dynamicForm.addEventListener("keypress", (e) => {
      if (e.key === "Enter") performSearch();
    });
  }
}

function selectSubCategory(sub) {
  currentSubCategory = sub;

  // Track Subcategory Click
  if (window.Analytics)
    Analytics.trackAction("Click Subcategoria", `${currentCategory}: ${sub}`);

  // Highlight selected subcategory
}

function selectCategory(cat) {
  currentCategory = cat;
  currentSubCategory = ""; // Reset subcategory when category changes

  // Track Category Click
  if (window.Analytics) Analytics.trackAction("Click Categoria", cat);

  // Update Help Section
  updateHelpSection(cat);

  // Update UI buttons
  document.querySelectorAll(".cat-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.cat === cat);
  });

  // Render Subcategory Selector if NOT Montura
  renderSubCategorySelector(cat);

  // Render Inputs
  renderDynamicForm(cat);

  // Clear results
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("resultsGrid").innerHTML = "";
}

function renderSubCategorySelector(cat) {
  const container = document.getElementById("subCategoryContainer");
  if (!container) return;

  // Clear previous
  container.innerHTML = "";
  container.classList.add("hidden");
  currentSubCategory = "";

  if (cat === "Montura") return; // No subcategory for Montura as per request

  // Extract unique subcategories
  const subs = [
    ...new Set(
      masterData
        .filter((item) => item.Categoria === cat || item.categoria === cat)
        .map((item) => item.Subcategoria || item.subcategoria)
        .filter(Boolean),
    ),
  ].sort();

  if (subs.length === 0) return;

  // Build Select
  const select = document.createElement("select");
  select.className = "form-input";
  select.style.marginBottom = "1rem";
  select.innerHTML = `<option value="">Seleccionar Subcategoría...</option>`;

  subs.forEach((sub) => {
    const option = document.createElement("option");
    option.value = sub;
    option.textContent = sub;
    select.appendChild(option);
  });

  select.addEventListener("change", (e) => {
    currentSubCategory = e.target.value;
  });

  // Label
  const label = document.createElement("label");
  label.className = "form-label";
  label.textContent = "Subcategoría";

  container.appendChild(label);
  container.appendChild(select);
  container.classList.remove("hidden");
}

function renderDynamicForm(cat) {
  const container = document.getElementById("dynamicForm");
  if (!container) return;
  container.innerHTML = "";

  let html = "";

  switch (cat) {
    case "Lentilla":
      html = `
                <div class="form-group">
                    <label class="form-label">Medida: </label>
                    <input type="text" id="inputMedida" class="form-input" placeholder="+0.00">
                </div>
            `;
      break;
    case "Material Listo":
      html = `
                <div class="dynamic-input-row">
                    <div class="form-group">
                        <label class="form-label">Medida (Ej: -2.75)</label>
                        <input type="text" id="inputMedida" class="form-input" placeholder="-2.75">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Adds (Ej: +1.25)</label>
                        <input type="text" id="inputAdds" class="form-input" placeholder="+1.25">
                    </div>
                </div>
            `;
      break;
    case "Block":
      html = `
                <div class="dynamic-input-row">
                    <div class="form-group">
                        <label class="form-label">Base (Ej: 4)</label>
                        <input type="text" id="inputBase" class="form-input" placeholder="4">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Adds (Ej: 100)</label>
                        <input type="text" id="inputAdds" class="form-input" placeholder="100">
                    </div>
                </div>
            `;
      break;
    case "Montura":
      html = `
                <div class="form-group">
                    <label class="form-label">Código (Ej: 8057)</label>
                    <input type="text" id="inputCodigo" class="form-input" placeholder="8057">
                </div>
            `;
      break;
  }

  container.innerHTML = html;

  // Auto focus first input
  const firstInput = container.querySelector("input");
  if (firstInput) firstInput.focus();
}

// --- Input Normalization ---
/**
 * Normalizes a user-typed medida string to match the format in the database.
 * Handles:
 *  - Commas → dots: "+1,50" → "+1.50"
 *  - Extra spaces: "+1.50 -4. 50" → "+1.50-4.50"
 *  - Missing decimals: "+150" → "+1.50", "-450" → "-4.50"
 *  - Cilindro keyword: "cilindro -0.25", "CILINDRO", "CIL" → "cil"
 */
function normalizeMedida(input) {
  if (!input) return "";

  let val = input.trim();

  // 1. Normalize "cilindro" / "CILINDRO" / "CIL" → "cil"
  val = val.replace(/\b(cilindro|CILINDRO|Cilindro|CIL|Cil)\b/g, "cil");

  // 2. Replace commas with dots (decimal separator)
  val = val.replace(/,/g, ".");

  // 3. Remove all spaces (handles "+1.50 -4. 50" → "+1.50-4.50")
  //    But preserve space between "cil" keyword and the number
  //    e.g. "cil -0.50" should stay as "cil -0.50"
  if (val.startsWith("cil")) {
    // Keep the space after "cil" but remove any other spaces
    const parts = val.match(/^(cil)\s*(.+)$/i);
    if (parts) {
      val = "cil " + parts[2].replace(/\s+/g, "");
    }
  } else {
    val = val.replace(/\s+/g, "");
  }

  // 4. Fix numbers missing decimal point: +150 → +1.50, -450 → -4.50
  //    Pattern: sign + 3 digits with no dot → insert dot after first digit
  val = val.replace(/([+-])(\d{3})(?!\d|\.)/g, (match, sign, digits) => {
    return `${sign}${digits[0]}.${digits[1]}${digits[2]}`;
  });

  return val;
}

// --- Search Logic ---
function performSearch() {
  const container = document.getElementById("dynamicForm");
  let queryMedida = "";
  let isMonturaSearch = currentCategory === "Montura";

  // Validate Subcategory
  if (!currentSubCategory) {
    if (window.UI)
      UI.showToast("⚠️ Por favor selecciona una subcategoría primero", "error");
    // Visually nudge the subcategory container
    const subCont = document.getElementById("subCategoryContainer");
    if (subCont) {
      subCont.style.transition = "transform 0.1s";
      subCont.style.transform = "translateX(5px)";
      setTimeout(() => (subCont.style.transform = "translateX(-5px)"), 100);
      setTimeout(() => (subCont.style.transform = "translateX(0)"), 200);
    }
    return;
  }

  // Track Search
  if (window.Analytics)
    Analytics.trackAction(
      "Busqueda",
      `${currentCategory} - ${currentSubCategory}`,
    );

  // 1. Format Search Query (with normalization)
  if (currentCategory === "Lentilla") {
    const raw = document.getElementById("inputMedida").value.trim();
    if (!raw) return UI.showToast("Ingresa una medida");
    const medida = normalizeMedida(raw);
    queryMedida = `Medida: ${medida}`;
  } else if (currentCategory === "Material Listo") {
    const rawMedida = document.getElementById("inputMedida").value.trim();
    const rawAdds = document.getElementById("inputAdds").value.trim();
    if (!rawMedida || !rawAdds) return UI.showToast("Ingresa medida y adds");
    queryMedida = `Medida: ${normalizeMedida(rawMedida)}_Adds: ${normalizeMedida(rawAdds)}`;
  } else if (currentCategory === "Block") {
    const base = document.getElementById("inputBase").value.trim();
    let rawAdds = document.getElementById("inputAdds").value.trim();
    if (!base || !rawAdds) return UI.showToast("Ingresa base y adds");

    // Specific Block Addition Normalization: +1.50 -> 150
    // Remove signs, commas to dots, then remove dot to get integer
    let normalizedAdds = rawAdds.replace(/[+-]/g, "").replace(/,/g, ".");
    if (normalizedAdds.includes(".")) {
      // If it's a decimal like 1.50, convert to 150
      normalizedAdds = normalizedAdds.replace(".", "");
    }

    queryMedida = `Base: ${base}_Adds: ${normalizedAdds}`;
  } else if (currentCategory === "Montura") {
    const codigo = document.getElementById("inputCodigo").value.trim();
    if (!codigo) return UI.showToast("Ingresa un código");
    queryMedida = `Codigo:${codigo}`;
  }

  // 2. Perform Filtering
  let results = [];

  if (isMonturaSearch) {
    results = masterData.filter((item) => {
      const cat = item.Categoria || item.categoria;
      const medida = item.medida || "";
      return (
        cat === "Montura" &&
        medida.toLowerCase().includes(queryMedida.toLowerCase())
      );
    });
  } else {
    results = masterData.filter((item) => {
      const cat = item.Categoria || item.categoria;
      const sub = item.Subcategoria || item.subcategoria;
      const itemMedida = item.medida || "";

      return (
        cat === currentCategory &&
        sub === currentSubCategory &&
        itemMedida.trim() === queryMedida
      );
    });
  }

  renderResults(results);
}

function renderResults(results) {
  const grid = document.getElementById("resultsGrid");
  const section = document.getElementById("resultsSection");
  grid.innerHTML = "";

  if (results.length === 0) {
    grid.innerHTML =
      '<div class="glass-card" style="padding:1rem; text-align:center;">No se encontraron productos.</div>';
  } else {
    results.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "product-card animate-fade-in";

      // Hint logic
      let hint = "";
      if (currentCategory === "Lentilla") {
        hint = "Precio por unidad";
      } else if (
        currentCategory === "Material Listo" ||
        currentCategory === "Block"
      ) {
        hint = "2 unidades = 1 par";
      }

      const nombre = item.Subcategoria || item.nombre;
      const precio = item.CF || item.cf || 0;
      const medida = item.medida;
      const sub = item.Subcategoria || "";
      const itemId = `item-${index}`;

      card.innerHTML = `
            <div class="product-header">
                <div class="product-info">
                    <h4>${sub}</h4>
                    <p>${medida}</p>
                    ${hint ? `<span class="pair-hint"><i class="fas fa-info-circle"></i> ${hint}</span>` : ""}
                </div>
                <div class="product-price">${precio} Bs.</div>
            </div>
            
            <div class="card-actions">
                <div class="qty-selector">
                    <button class="qty-btn" onclick="changeQty('${itemId}', -1)">-</button>
                    <span id="${itemId}" class="qty-val">1</span>
                    <button class="qty-btn" onclick="changeQty('${itemId}', 1)">+</button>
                </div>
                <!-- Need to be careful with JSON.stringify and quotes -->
                <button class="btn-add" id="btn-${itemId}">
                    Agregar <i class="fas fa-cart-plus"></i>
                </button>
            </div>
      `;

      grid.appendChild(card);

      // Attach event listener properly to avoid inline JS escaping issues
      document.getElementById(`btn-${itemId}`).addEventListener("click", () => {
        addToCartWithQty(item, itemId);
      });
    });
  }

  section.classList.remove("hidden");
}

// Global helpers for inline onclicks/calls
window.changeQty = function (id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  let val = parseInt(el.textContent);
  val += delta;
  if (val < 1) val = 1;
  el.textContent = val;
};

window.addToCartWithQty = function (item, qtyId) {
  const el = document.getElementById(qtyId);
  if (!el) return;
  const qty = parseInt(el.textContent);
  addToCart(item, qty);
};

// --- Cart Logic ---
// --- Cart Logic ---
function addToCart(item, quantity = 1) {
  // Check if exists
  const existing = cart.find(
    (i) =>
      (i["# idPrecio"] && i["# idPrecio"] === item["# idPrecio"]) ||
      (i.Subcategoria === item.Subcategoria && i.medida === item.medida),
  );

  if (existing) {
    existing.qty += quantity;
  } else {
    cart.push({
      ...item,
      qty: quantity,
    });
  }

  renderCart();
  if (window.UI) UI.updateCartBadge(window.cart.length);
  if (window.UI) UI.showToast("Producto agregado al pedido");
}

function updateCartQty(index, delta) {
  if (window.cart[index]) {
    window.cart[index].qty += delta;
    if (window.cart[index].qty < 1) window.cart[index].qty = 1;
    renderCart();
    if (window.UI) UI.updateCartBadge(window.cart.length);
  }
}

function removeFromCart(index) {
  window.cart.splice(index, 1);
  renderCart();
  if (window.UI) UI.updateCartBadge(window.cart.length);
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const section = document.getElementById("cartSection");
  const totalEl = document.getElementById("grandTotal");

  if (!container) return;
  container.innerHTML = "";

  // -- Proforma Header for Cart --
  const user = Auth ? Auth.getUser() : null;
  const dateStr = new Date().toLocaleDateString("es-ES");

  if (user) {
    const headerDiv = document.createElement("div");
    headerDiv.id = "cartHeader";
    headerDiv.className = "cart-proforma-header";
    headerDiv.innerHTML = `
        <div class="proforma-title">Detalle del Pedido</div>
        <div class="proforma-meta">
            <div><strong>Cliente:</strong> ${user.name}</div>
            <div><strong>Fecha:</strong> ${dateStr}</div>
            ${user.nit ? `<div><strong>NIT:</strong> ${user.nit}</div>` : ""}
        </div>
        <hr class="proforma-divider">
      `;
    container.appendChild(headerDiv);
  }

  let total = 0;

  window.cart.forEach((item, index) => {
    const precio = parseFloat(item.CF || item.cf || 0);
    const subtotal = precio * item.qty;
    total += subtotal;
    const nombre = item.Subcategoria || item.nombre;
    const categoria = item.Categoria || item.categoria || "";

    // --- Smart quantity label ---
    let qtyLabel = "";
    if (categoria === "Lentilla") {
      if (item.qty === 1) {
        qtyLabel = `<span class="qty-label lentilla">1/2 (1 und)</span>`;
      } else if (item.qty % 2 === 0) {
        const pares = item.qty / 2;
        qtyLabel = `<span class="qty-label lentilla">${pares} Par${pares > 1 ? "es" : ""} (${item.qty} und)</span>`;
      } else {
        const pares = Math.floor(item.qty / 2);
        qtyLabel = `<span class="qty-label lentilla">${pares} Par${pares > 1 ? "es" : ""} y medio (${item.qty} und)</span>`;
      }
    } else if (categoria === "Material Listo" || categoria === "Block") {
      qtyLabel = `<span class="qty-label par">${item.qty} PAR${item.qty > 1 ? "ES" : ""}</span>`;
    }

    // --- Category badge ---
    const catLabel =
      categoria === "Lentilla"
        ? "Organico / Vidrio"
        : categoria === "Material Listo"
          ? "Material Listo"
          : categoria === "Block"
            ? "Block"
            : categoria;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
            <div class="cart-item-details">
                <div class="cart-cat-badge">${catLabel}</div>
                <h4>${nombre}</h4>
                <p>${item.medida}</p>
                <div class="item-price-unit">${precio} Bs. c/u</div>
                ${qtyLabel}
            </div>
            <div class="cart-controls">
                <div class="cart-qty-editor">
                    <button class="qty-btn-mini" onclick="updateCartQty(${index}, -1)">-</button>
                    <span class="qty-display">${item.qty}</span>
                    <button class="qty-btn-mini" onclick="updateCartQty(${index}, 1)">+</button>
                </div>
                <div class="item-subtotal">${subtotal.toFixed(2)} Bs.</div>
                <button class="delete-link" onclick="removeFromCart(${index})">Eliminar</button>
            </div>
        `;
    container.appendChild(div);
  });

  // Note: We used inline onclicks for simplicity here, but ensure functions are global
  // global helpers are added below

  totalEl.textContent = `${total.toFixed(2)} Bs.`;

  // Update Floating Button
  updateFloatingCart(cart.length);

  if (cart.length > 0) {
    section.classList.remove("hidden");
  } else {
    section.classList.add("hidden");
  }
}

function updateFloatingCart(count) {
  if (window.UI)
    UI.updateCartBadge(count !== undefined ? count : window.cart.length);
}

window.scrollToCart = function () {
  if (!window.cart || window.cart.length === 0) {
    if (window.UI)
      UI.showToast("Debe tener al menos un producto en su pedido", "error");
    return;
  }
  const section = document.getElementById("cartSection");
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
};

function toggleHelp() {
  const help = document.getElementById("helpSection");
  if (!help) return;
  const isCollapsed = help.classList.contains("collapsed");

  if (isCollapsed) {
    help.classList.remove("collapsed");
    localStorage.setItem("helpCollapsed", "false");
  } else {
    help.classList.add("collapsed");
    localStorage.setItem("helpCollapsed", "true");
  }
}

function updateHelpSection(cat) {
  const help = document.getElementById("helpSection");
  if (!help) return;

  const isCollapsed = localStorage.getItem("helpCollapsed") === "true";
  if (isCollapsed) help.classList.add("collapsed");

  let contentHtml = "";

  if (cat === "Lentilla") {
    contentHtml = `
      <ul class="help-list">
        <li>Selecciona el material (ej. Organico Blanco).</li>
        <li>Si es esferico positivo usa <span class="help-example">+1.25</span></li>
        <li>Si es esferico negativo usa <span class="help-example">-1.25</span></li>
        <li>Si es neutro usa <span class="help-example">+0.00</span></li>
        <li>Para medida combinada positivo/negativo <span class="help-example">+1.25-1.50</span> o <span class="help-example">-1.50-1.50</span></li>
        <li>Si solo es cilindro usa <span class="help-example">cil -0.50</span></li>
      </ul>
    `;
  } else if (cat === "Material Listo") {
    contentHtml = `
      <ul class="help-list">
        <li>Ingresa el valor esférico en el primer campo (ej. <span class="help-example">+1.50</span>).</li>
        <li>Ingresa la adición (adds) en el segundo campo (ej. <span class="help-example">+1.25</span>).</li>
      </ul>
    `;
  } else if (cat === "Block") {
    contentHtml = `
      <ul class="help-list">
        <li>Las bases disponibles son únicamente <span class="help-example">4</span> y <span class="help-example">6</span>.</li>
        <li>En adición escribe el valor entero (ej. <span class="help-example">225</span> para 2.25).</li>
        <li>No te preocupes por los signos, el sistema los corrige automáticamente.</li>
      </ul>
    `;
  }

  const title =
    cat === "Lentilla"
      ? "Orgánicos / Vidrios"
      : cat === "Material Listo"
        ? "Material Listo"
        : cat === "Block"
          ? "Blocks"
          : cat;

  help.innerHTML = `
    <div class="help-header" onclick="toggleHelp()">
      <div class="help-title-row">
        <i class="fas fa-question-circle pulse-icon"></i>
        <span>¿Necesitas ayuda con <strong>${title}</strong>?</span>
      </div>
      <i class="fas fa-chevron-down toggle-icon"></i>
    </div>
    <div class="help-content">
      ${contentHtml}
    </div>
  `;
}

// Global helpers for cart actions
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;

// --- WhatsApp Logic ---
function generateWhatsApp() {
  if (cart.length === 0) {
    if (window.UI)
      UI.showToast(
        "🛒 Tu pedido está vacío. Agregá productos primero.",
        "error",
      );
    return;
  }

  const user = Auth.getUser();
  if (!user) return UI.showToast("Error de usuario");

  // Track Order in Analytics
  if (window.Analytics) Analytics.trackOrder(user, cart, paymentMethod);

  const date = new Date().toLocaleDateString("es-ES");

  let message = `*Óptica:* ${user.name}\n`;
  message += `*Fecha:* ${date}\n`;
  message += `*Método de Pago:* ${paymentMethod}\n`;
  message += `Este es mi Pedido:\n\n`;

  cart.forEach((item) => {
    const nombre = item.Subcategoria || item.nombre;
    const categoria = item.Categoria || item.categoria || currentCategory;

    // Format quantity based on category
    let cantidadTexto = "";

    if (categoria === "Lentilla") {
      // For Lentilla: 1 = "1/2", 2 = "1 Par", 3 = "1 Par y medio", etc.
      if (item.qty === 1) {
        cantidadTexto = "1/2 (1 unidad)";
      } else if (item.qty % 2 === 0) {
        const pares = item.qty / 2;
        cantidadTexto = `${pares} Par${pares > 1 ? "es" : ""} (${item.qty} Unidades)`;
      } else {
        const pares = Math.floor(item.qty / 2);
        cantidadTexto = `${pares} Par${pares > 1 ? "es" : ""} y medio (${item.qty} Unidades)`;
      }
    } else if (categoria === "Material Listo" || categoria === "Block") {
      // For Material Listo and Block: 1 unit = 1 Par (already comes as pair)
      cantidadTexto = `${item.qty} Par${item.qty > 1 ? "es" : ""}`;
    } else {
      // For Montura or others: just show quantity
      cantidadTexto = `${item.qty}`;
    }

    message += `*Material:* ${nombre}\n`;
    message += `${item.medida}\n`;
    message += `*Cantidad:* ${cantidadTexto}\n`;
    message += `-------------------------------------------\n`;
  });

  message += `Gracias, Espero Confirmacion`;

  const whatsappUrl = `https://wa.me/59167724661?text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, "_blank");

  // Clear cart after sending
  window.cart = [];
  renderCart();
  if (window.UI) {
    UI.updateCartBadge(0);
    UI.showToast("Pedido enviado. Carrito limpiado.");
  }
}
