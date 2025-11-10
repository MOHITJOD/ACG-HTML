/*
 * script.js
 * Main logic for the booking page.
 */
/*
 * This mock data is now part of the main script
 */
const cruises = [
  {
    id: "cruise-1",
    title: "Sydney Harbour Gold Penfolds Dinner Cruise",
    prices: [
      { type: "Adult", price: "$149" },
      { type: "Child", price: "$99" },
    ],
    schedule: {
      boarding: "18:40",
      departs: "19:00",
      returns: "21:50",
    },
    upgrades: [
      {
        name: "Guaranteed Window Seat",
        price: "+$25",
        description: "Enjoy spectacular views with a guaranteed window seat.",
        image: "assets/snow upgrad 3.jpg",
      },
      {
        name: "Celebration Package",
        price: "+$49",
        description:
          "Includes a bottle of sparkling wine, chocolates, and a small cake.",
        image: "assets/snow upgrad 2.png",
      },
    ],
    sideHighlights: [
      "3-hour cruise on Sydney Harbour",
      "Signature 3-course menu",
      "Paired Penfolds gold label wines",
      "Live music and ambient lighting",
      "Stunning harbour views",
    ],
  },
];
// Wait for the DOM to be fully loaded before running scripts
document.addEventListener("DOMContentLoaded", () => {
  // --- STATE ---
  // This section replaces React's `useState`
  let selectedDate = "";
  let adultCount = 1;
  let childCount = 0;
  let selectedDepartureTime = "19:00";
  let selectedUpgradeQty = {}; // { 0: 1, 1: 0 }
  let expandedSections = {
    bookingDetails: true,
    upgrades: false,
    bookingSummary: false,
  };
  let expandedUpgrades = {}; // { 0: true, 1: false }
  let formData = {
    fullName: "",
    email: "",
    contactNumber: "",
    country: "",
    state: "",
    postcode: "",
    additionalComments: "",
    hearAboutUs: "",
  };
  let formErrors = {};
  let isSubmitting = false;
  let calendarYear = new Date().getFullYear();
  let calendarMonth = new Date().getMonth(); // 0-11
  let showAdultMenu = false;
  let showChildMenu = false;
  // Step gating
  let canOpenUpgrades = false;
  let canOpenBookingSummary = false;

  // --- DATA ---
  if (typeof cruises === "undefined") {
    console.error("cruise data not loaded!");
    return;
  }
  const cruiseData = cruises.find((c) => c.id === "cruise-1");
  if (!cruiseData) {
    document.body.innerHTML = "Cruise not found";
    return;
  }

  const adultPrice = parseFloat(
    cruiseData.prices[0]?.price.replace("$", "") || "0"
  );
  const childPrice = parseFloat(
    cruiseData.prices[1]?.price.replace("$", "") || "0"
  );
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // --- PriceCalendar (from script.js 1-234) ---
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const fmtPrice = (n, currency = "USD") => {
    if (n == null) return "";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
      }).format(n);
    } catch {
      return "$" + Number(n).toFixed(0);
    }
  };
  const monthLabel = (y, m) =>
    new Date(y, m - 1, 1).toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });

  class PriceCalendar {
    constructor(root, opts = {}) {
      this.root = root;
      const today = new Date();
      this.viewYear = opts.startDate?.getFullYear?.() ?? today.getFullYear();
      this.viewMonth = (opts.startDate?.getMonth?.() ?? today.getMonth()) + 1;
      this.minDate = opts.minDate ?? null;
      this.maxDate = opts.maxDate ?? null;
      this.currency = opts.currency ?? "USD";

      this.defaultPrice = null;
      this.priceOverrides = new Map();
      this.unavailable = new Set();
      this.selected = null;
      this.onSelect = null;

      this._build();
      this.render();
    }
    setDefaultPrice(amount) {
      this.defaultPrice = Number(amount);
      this.render();
    }
    setPrice(isoDate, amount) {
      if (amount == null) this.priceOverrides.delete(isoDate);
      else this.priceOverrides.set(isoDate, Number(amount));
      this.render();
    }
    clearPrice(isoDate) {
      this.priceOverrides.delete(isoDate);
      this.render();
    }
    setBulkPrices(mapObj) {
      for (const [iso, amt] of Object.entries(mapObj)) this.setPrice(iso, amt);
    }
    setUnavailable(listISO) {
      this.unavailable = new Set(listISO || []);
      this.render();
    }
    goto(y, m) {
      this.viewYear = y;
      this.viewMonth = m;
      this.render();
    }
    next() {
      let y = this.viewYear,
        m = this.viewMonth + 1;
      if (m > 12) {
        m = 1;
        y++;
      }
      this.goto(y, m);
    }
    prev() {
      let y = this.viewYear,
        m = this.viewMonth - 1;
      if (m < 1) {
        m = 12;
        y--;
      }
      this.goto(y, m);
    }
    _build() {
      this.root.className = "calendar";
      const header = document.createElement("div");
      header.className = "cal-header";
      header.innerHTML = `
        <div class="cal-nav">
          <button class="cal-btn" data-nav="prev" aria-label="Previous month">&lsaquo;</button>
        </div>
        <div class="cal-month" id="cal-month-label"></div>
        <div class="cal-nav">
          <button class="cal-btn" data-nav="next" aria-label="Next month">&rsaquo;</button>
        </div>
      `;
      this.root.appendChild(header);
      header.addEventListener("click", (e) => {
        if (e.target.closest('[data-nav="prev"]')) this.prev();
        if (e.target.closest('[data-nav\="next\"]')) this.next();
      });
      const grid = document.createElement("div");
      this.grid = grid;
      grid.className = "cal-grid";
      this.root.appendChild(this._dowRow());
      this.root.appendChild(grid);
    }
    _dowRow() {
      const wrap = document.createElement("div");
      wrap.className = "cal-grid";
      const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      for (const n of names) {
        const el = document.createElement("div");
        el.className = "cal-dow";
        el.textContent = n;
        wrap.appendChild(el);
      }
      return wrap;
    }
    render() {
      const monthLabelEl = this.root.querySelector("#cal-month-label");
      if (monthLabelEl)
        monthLabelEl.textContent = monthLabel(this.viewYear, this.viewMonth);
      this.grid.innerHTML = "";
      const first = new Date(this.viewYear, this.viewMonth - 1, 1);
      const last = new Date(this.viewYear, this.viewMonth, 0);
      const startWeekDay = (first.getDay() + 6) % 7; // Monday=0
      const daysInMonth = last.getDate();
      const cells = [];
      for (let i = 0; i < startWeekDay; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) cells.push({ d });
      const now = new Date();
      const todayISO = toISO(
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate()
      );
      for (const cell of cells) {
        const el = document.createElement("div");
        el.className = "cal-cell";
        if (!cell) {
          el.classList.add("out");
          this.grid.appendChild(el);
          continue;
        }
        const iso = toISO(this.viewYear, this.viewMonth, cell.d);
        const isUnavailable =
          this.unavailable.has(iso) || !this._withinBounds(iso);
        if (isUnavailable) el.classList.add("disabled");
        if (iso === todayISO) el.classList.add("today");
        if (this.selected === iso) el.classList.add("selected");
        const day = document.createElement("div");
        day.className = "cal-day";
        day.textContent = cell.d;
        const priceEl = document.createElement("div");
        priceEl.className = "cal-price";
        const price = this.priceOverrides.has(iso)
          ? this.priceOverrides.get(iso)
          : this.defaultPrice;
        priceEl.textContent = price != null ? fmtPrice(price, this.currency) : "";
        el.appendChild(day);
        el.appendChild(priceEl);
        if (!isUnavailable) {
          el.addEventListener("click", () => {
            this.selected = iso;
            this.render();
            if (typeof this.onSelect === "function") {
              const p = this.priceOverrides.has(iso)
                ? this.priceOverrides.get(iso)
                : this.defaultPrice;
              this.onSelect(iso, p);
            }
          });
        }
        this.grid.appendChild(el);
      }
    }
    _withinBounds(iso) {
      const d = new Date(iso + "T00:00:00");
      if (this.minDate && d < this._clipDate(this.minDate)) return false;
      if (this.maxDate && d > this._clipDate(this.maxDate)) return false;
      return true;
    }
    _clipDate(dt) {
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }
  }

  // --- DOM SELECTORS ---
  const dom = {
    cruiseTitle: document.getElementById("cruise-title"),
    accordions: {
      bookingDetails: {
        btn: document.getElementById("accordion-btn-bookingDetails"),
        icon: document.getElementById("accordion-icon-bookingDetails"),
        content: document.getElementById("accordion-content-bookingDetails"),
      },
      upgrades: {
        btn: document.getElementById("accordion-btn-upgrades"),
        icon: document.getElementById("accordion-icon-upgrades"),
        content: document.getElementById("accordion-content-upgrades"),
      },
      bookingSummary: {
        btn: document.getElementById("accordion-btn-bookingSummary"),
        icon: document.getElementById("accordion-icon-bookingSummary"),
        content: document.getElementById("accordion-content-bookingSummary"),
      },
    },
    calendar: {
      error: document.getElementById("error-date"),
    },
    guests: {
      adultBtn: document.getElementById("adult-count-btn"),
      adultMenu: document.getElementById("adult-menu"),
      childBtn: document.getElementById("child-count-btn"),
      childMenu: document.getElementById("child-menu"),
      dep1900: document.getElementById("dep-1900"),
      dep1700: document.getElementById("dep-1700"),
    },
    bookingFlow: {
      proceedBtn: document.getElementById("proceed-upgrades-btn"),
      skipBtn: document.getElementById("skip-upgrades-btn"),
      upgradesProceedPayBtn: document.getElementById(
        "upgrades-proceed-pay-btn"
      ),
    },
    upgrades: {
      container: document.getElementById("upgrades-container"),
    },
    form: {
      form: document.getElementById("booking-form"),
      fullName: document.getElementById("fullName"),
      email: document.getElementById("email"),
      contactNumber: document.getElementById("contactNumber"),
      country: document.getElementById("country"),
      state: document.getElementById("state"),
      postcode: document.getElementById("postcode"),
      hearAboutUs: document.getElementById("hearAboutUs"),
      additionalComments: document.getElementById("additionalComments"),
    },
    errors: {
      fullName: document.getElementById("error-fullName"),
      email: document.getElementById("error-email"),
      contactNumber: document.getElementById("error-contactNumber"),
      country: document.getElementById("error-country"),
      state: document.getElementById("error-state"),
    },
    summary: {
      boards: document.getElementById("summary-boards"),
      departs: document.getElementById("summary-departs"),
      returns: document.getElementById("summary-returns"),
      dateTitle: document.getElementById("summary-date-title"),
      basePrices: document.getElementById("summary-base-prices"),
      upgradesWrapper: document.getElementById("summary-upgrades-wrapper"),
      upgradesList: document.getElementById("summary-upgrades-list"),
      total: document.getElementById("summary-total"),
      inclusionsList: document.getElementById("summary-inclusions-list"),
    },
    submitBtn: document.getElementById("submit-btn"),
    payments: {
      payCard: document.getElementById("pay-card"),
      payGPay: document.getElementById("pay-gpay"),
      payApple: document.getElementById("pay-apple"),
      cardTypeWrap: document.getElementById("card-type-wrap"),
      cardType: document.getElementById("card-type"),
      cardFeeNote: document.getElementById("card-fee-note"),
    },
    coupon: {
      toggle: document.getElementById("coupon-toggle"),
      box: document.getElementById("coupon-box"),
      input: document.getElementById("coupon-code"),
      apply: document.getElementById("coupon-apply"),
      msg: document.getElementById("coupon-msg"),
    },
  };

  // --- RENDER FUNCTIONS ---

  /**
   * Generates the list of upgrade items
   */
  function renderUpgradesList() {
    let upgradesHtml = "";
    cruiseData.upgrades.forEach((upgrade, index) => {
      const qty = selectedUpgradeQty[index] || 0;
      const isOpen = !!expandedUpgrades[index];

      // Use Bootstrap .media object
      upgradesHtml += `
        <div class="col-md-6 upgrade-item-wrapper" data-upgrade-index="${index}">
          <div class="upgrade-item">
            <div class="media">
              <div class="media-body">
                <h4 class="media-heading">${upgrade.name}</h4>
                <p class="upgrade-description ${isOpen ? "" : "hidden"}">
                  ${upgrade.description || ""}
                </p>
                <div class="upgrade-controls">
                  ${
                    qty === 0
                      ? `
                    <button
                      type="button"
                      class="add-upgrade-btn btn btn-success add-upgrade-btn"
                    >
                      Add
                      <i class="bi bi-chevron-down text-xs" style="margin-left: 8px;"></i>
                    </button>
                  `
                      : `
                    <div class="btn-group" role="group">
                      <button type="button" class="dec-upgrade-btn btn btn-success">-</button>
                      <button type="button" class="btn btn-success" disabled style="opacity: 1; min-width: 40px;">${String(
                        qty
                      ).padStart(2, "0")}</button>
                      <button type="button" class="inc-upgrade-btn btn btn-success">+</button>
                    </div>
                  `
                  }
                  <span class="upgrade-price">${upgrade.price}</span>
                </div>
              </div>
              ${
                upgrade.image
                  ? `
                <div class="media-right">
                  <div class="upgrade-image-wrap">
                    <img
                      class="media-object object-fit-cover"
                      src="${upgrade.image}"
                      alt="${upgrade.name}"
                    />
                  </div>
                  <a href="#" class="toggle-upgrade-details view-more-link">View more details</a>
                </div>
              `
                  : `
                <div class="media-right">
                  <a href="#" class="toggle-upgrade-details view-more-link">View more details</a>
                </div>
              `
              }
            </div>
          </div>
        </div>
      `;
    });
    dom.upgrades.container.innerHTML = upgradesHtml;
  }

  /**
   * Renders the dynamic parts of the right-hand booking summary
   */
  function updateBookingSummary() {
    // Base Prices
    let baseHtml = `
      <div class="summary-row">
        <span>Adults - ${adultCount} x $${adultPrice}</span>
        <span>$${(adultCount * adultPrice).toFixed(2)}</span>
      </div>
    `;
    if (childCount > 0) {
      baseHtml += `
        <div class="summary-row">
          <span>Children - ${childCount} x $${childPrice}</span>
          <span>$${(childCount * childPrice).toFixed(2)}</span>
        </div>
      `;
    }
    dom.summary.basePrices.innerHTML = baseHtml;

    // Upgrades
    let upgradesHtml = "";
    let upgradeTotal = 0;
    let hasUpgrades = false;

    cruiseData.upgrades.forEach((upgrade, index) => {
      const qty = selectedUpgradeQty[index] || 0;
      if (qty > 0) {
        hasUpgrades = true;
        const price = parseFloat(upgrade.price.replace("+$", ""));
        upgradeTotal += price * qty;
        upgradesHtml += `
          <div class="summary-row">
            <span>${upgrade.name} (x${qty})</span>
            <span>+$${(price * qty).toFixed(2)}</span>
          </div>
        `;
      }
    });

    dom.summary.upgradesList.innerHTML = upgradesHtml;
    dom.summary.upgradesWrapper.classList.toggle("hidden", !hasUpgrades);

    // Total
    const baseTotal = adultCount * adultPrice + childCount * childPrice;
    const total = baseTotal + upgradeTotal;
    dom.summary.total.textContent = `Total $${total.toFixed(2)}`;

    // Date
    dom.summary.dateTitle.textContent = selectedDate
      ? `Cruise Date: ${new Date(selectedDate + "T00:00:00").toLocaleDateString(
          "en-US",
          { month: "long", day: "numeric", year: "numeric" }
        )}`
      : "Select Cruise Date";
  }

  function getCurrentBaseTotal() {
    let upgradeTotal = 0;
    cruiseData.upgrades.forEach((upgrade, index) => {
      const qty = selectedUpgradeQty[index] || 0;
      if (qty > 0) {
        const price = parseFloat(upgrade.price.replace("+$", ""));
        upgradeTotal += price * qty;
      }
    });
    const base = adultCount * adultPrice + childCount * childPrice;
    return base + upgradeTotal;
  }

  function parseCardFeePercent() {
    const val = dom.payments.cardType?.value || "master-1.65";
    const parts = val.split("-");
    const pct = parseFloat(parts[1] || "0");
    return isNaN(pct) ? 0 : pct;
  }

  function refreshPaySection() {
    const usingCard = dom.payments.payCard?.checked;
    if (dom.payments.cardTypeWrap) {
      dom.payments.cardTypeWrap.classList.toggle("hidden", !usingCard);
    }
    const base = getCurrentBaseTotal();
    let totalWithFee = base;
    let note = "";
    if (usingCard) {
      const pct = parseCardFeePercent();
      const fee = base * (pct / 100);
      totalWithFee = base + fee;
      note = `A ${pct.toFixed(
        2
      )}% credit card processing fee $${fee.toFixed(2)} will be added.`;
    }
    if (dom.payments.cardFeeNote) dom.payments.cardFeeNote.textContent = note;
    if (dom.submitBtn)
      dom.submitBtn.textContent = `Pay $${totalWithFee.toFixed(2)}`;
  }

  /**
   * Loads static data into the summary panel
   */
  function renderStaticData() {
    dom.cruiseTitle.textContent =
      cruiseData.title + " with Signature Menu and Drinks";
    
    // Assumes HTML is updated to a <dl>
    dom.summary.boards.textContent = cruiseData.schedule?.boarding || "--";
    dom.summary.departs.textContent = cruiseData.schedule?.departs || "--";
    dom.summary.returns.textContent = cruiseData.schedule?.returns || "--";

    dom.summary.inclusionsList.innerHTML = cruiseData.sideHighlights
      .map(
        (item) => `
        <li>
          <span class="inclusion-icon">
            <i class="bi bi-check"></i>
          </span>
          <span>${item}</span>
        </li>
      `
      )
      .join("");
  }

  /**
   * Generates the dropdown menus for guest selection
   */
  function populateGuestMenus() {
    let adultHtml = "";
    for (let i = 1; i <= 20; i++) {
      adultHtml += `
        <button type="button" data-value="${i}" class="dropdown-item ${
        adultCount === i ? "active" : ""
      }">
          ${String(i).padStart(2, "0")}
        </button>
      `;
    }
    dom.guests.adultMenu.innerHTML = adultHtml;

    let childHtml = "";
    for (let i = 0; i <= 20; i++) {
      childHtml += `
        <button type="button" data-value="${i}" class="dropdown-item ${
        childCount === i ? "active" : ""
      }">
          ${String(i).padStart(2, "0")}
        </button>
      `;
    }
    dom.guests.childMenu.innerHTML = childHtml;
  }

  /**
   * Toggles an accordion section open or closed
   */
  function toggleSection(sectionName) {
    const section = dom.accordions[sectionName];
    if (!section) return;
    // Gate access by step
    if (sectionName === "upgrades" && !canOpenUpgrades) return;
    if (sectionName === "bookingSummary" && !canOpenBookingSummary) return;

    expandedSections[sectionName] = !expandedSections[sectionName];
    const isOpen = expandedSections[sectionName];

    section.content.classList.toggle("hidden", !isOpen);
    section.icon.classList.toggle("rotate-180", isOpen);
    section.btn
      .querySelector("h3")
      .classList.toggle("text-primary-custom", isOpen);
    section.btn
      .querySelector("h3")
      .classList.toggle("text-dark-custom", !isOpen);
  }

  function setAccordionEnabled(sectionName, enabled) {
    const section = dom.accordions[sectionName];
    if (!section) return;
    section.btn.classList.toggle("opacity-50", !enabled); // Simple opacity toggle
    section.btn.style.pointerEvents = enabled ? "auto" : "none";
  }

  function validateBookingDetailsStep() {
    let valid = true;
    // Date is required to progress from Booking Details
    if (!selectedDate) {
      dom.calendar.error.textContent = "Please select a cruise date";
      valid = false;
    }
    return valid;
  }

  function goToUpgrades() {
    if (!validateBookingDetailsStep()) return;
    canOpenUpgrades = true;
    canOpenBookingSummary = true; // allow jumping to summary after upgrades available
    setAccordionEnabled("upgrades", true);
    setAccordionEnabled("bookingSummary", true);
    // Open upgrades, close booking details
    if (!expandedSections.upgrades) toggleSection("upgrades");
    if (expandedSections.bookingDetails) toggleSection("bookingDetails");
  }

  function skipToSummary() {
    if (!validateBookingDetailsStep()) return;
    canOpenBookingSummary = true;
    setAccordionEnabled("bookingSummary", true);
    // Close booking details, open summary
    if (expandedSections.bookingDetails) toggleSection("bookingDetails");
    if (!expandedSections.bookingSummary) toggleSection("bookingSummary");
  }

  function proceedToPayFromUpgrades() {
    canOpenBookingSummary = true;
    setAccordionEnabled("bookingSummary", true);
    if (!expandedSections.bookingSummary) toggleSection("bookingSummary");
    if (expandedSections.upgrades) toggleSection("upgrades");
    // Smooth scroll to summary form
    dom.accordions.bookingSummary.btn.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  /**
   * Validates the form and displays errors
   */
  function validateForm() {
    formErrors = {}; // Clear previous errors
    let isValid = true;

    // Clear all error messages and states
    Object.keys(dom.errors).forEach((key) => {
      if (dom.errors[key]) {
        dom.errors[key].textContent = "";
      }
    });
    Object.keys(dom.form).forEach((key) => {
      if (dom.form[key] && dom.form[key].closest(".form-group")) {
        dom.form[key].closest(".form-group").classList.remove("has-error");
      }
    });
    dom.calendar.error.textContent = "";

    // Check fields
    if (!formData.fullName.trim()) {
      formErrors.fullName = "Full name is required";
      dom.errors.fullName.textContent = formErrors.fullName;
      dom.form.fullName.closest(".form-group").classList.add("has-error");
      isValid = false;
    }
    if (!formData.email.trim()) {
      formErrors.email = "Email is required";
      dom.errors.email.textContent = formErrors.email;
      dom.form.email.closest(".form-group").classList.add("has-error");
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      formErrors.email = "Please enter a valid email address";
      dom.errors.email.textContent = formErrors.email;
      dom.form.email.closest(".form-group").classList.add("has-error");
      isValid = false;
    }
    if (!formData.contactNumber.trim()) {
      formErrors.contactNumber = "Contact number is required";
      dom.errors.contactNumber.textContent = formErrors.contactNumber;
      dom.form.contactNumber.closest(".form-group").classList.add("has-error");
      isValid = false;
    }
    if (!formData.country.trim()) {
      formErrors.country = "Country is required";
      dom.errors.country.textContent = formErrors.country;
      dom.form.country.closest(".form-group").classList.add("has-error");
      isValid = false;
    }
    if (!formData.state.trim()) {
      formErrors.state = "State is required";
      dom.errors.state.textContent = formErrors.state;
      dom.form.state.closest(".form-group").classList.add("has-error");
      isValid = false;
    }
    if (!selectedDate) {
      formErrors.date = "Please select a cruise date";
      dom.calendar.error.textContent = formErrors.date;
      isValid = false;
    }

    return isValid;
  }

  /**
   * Handles form submission
   */
  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      // If validation fails, open the sections with errors
      if (formErrors.date && !expandedSections.bookingDetails) {
        toggleSection("bookingDetails");
      }
      if (
        (formErrors.fullName || formErrors.email) &&
        !expandedSections.bookingSummary
      ) {
        toggleSection("bookingSummary");
      }
      return;
    }

    isSubmitting = true;
    dom.submitBtn.disabled = true;
    dom.submitBtn.textContent = "Processing...";

    // Simulate API call
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      alert(
        "Booking submitted successfully! You will receive a confirmation email shortly."
      );
      // Here you would typically redirect or clear the form
    } catch (error) {
      alert("There was an error submitting your booking. Please try again.");
    } finally {
      isSubmitting = false;
      dom.submitBtn.disabled = false;
      // dom.submitBtn.textContent = "Proceed to Pay"; // Or reset by calling refreshPaySection
      refreshPaySection();
    }
  }

  /**
   * Updates the guest selector button label and chevron state
   */
  function updateGuestButtonLabel(kind, count, isOpen) {
    const label = String(count).padStart(2, "0");
    const iconClass = isOpen ? "bi-chevron-up" : "bi-chevron-down";
    const btn = kind === "adult" ? dom.guests.adultBtn : dom.guests.childBtn;
    if (btn) {
      btn.innerHTML = `${label} <i class="bi ${iconClass} text-xs"></i>`;
    }
  }

  function updateDepartureButtons() {
    const r1900 = dom.guests.dep1900;
    const r1700 = dom.guests.dep1700;
    if (!r1900 || !r1700) return;
    r1900.checked = selectedDepartureTime === "19:00";
    r1700.checked = selectedDepartureTime === "17:00";
    // Toggle active class on labels for broader browser support
    document
      .querySelectorAll('.departure-radio-group .dep-option')
      .forEach((label) => label.classList.remove('active'));
    const activeInput = r1900.checked ? r1900 : r1700;
    const activeLabel = activeInput?.closest('label.dep-option');
    if (activeLabel) activeLabel.classList.add('active');
  }

  function updateProceedButtonsState() {
    const hasDate = !!selectedDate;
    const hasTime = !!selectedDepartureTime;
    const active = hasDate && hasTime;
    const proceed = dom.bookingFlow.proceedBtn;
    const skip = dom.bookingFlow.skipBtn;
    if (!proceed || !skip) return;

    // Clear all states
    proceed.classList.remove("btn-success", "btn-default", "disabled");
    skip.classList.remove(
      "btn-primary-outline",
      "btn-default-disabled",
      "disabled"
    );

    if (active) {
      proceed.classList.add("btn-success");
      proceed.disabled = false;

      skip.classList.add("btn-primary-outline");
      skip.disabled = false;
    } else {
      proceed.classList.add("btn-default", "disabled");
      proceed.disabled = true;

      skip.classList.add("btn-default-disabled", "disabled");
      skip.disabled = true;
    }
  }

  // --- EVENT LISTENERS ---

  // Accordions
  Object.keys(dom.accordions).forEach((sectionName) => {
    if (dom.accordions[sectionName].btn) {
      dom.accordions[sectionName].btn.addEventListener("click", () =>
        toggleSection(sectionName)
      );
    }
  });

  // Move Booking Summary card into mobile accordion on small screens
  const sidebarWrapper = document.querySelector(".sidebar-wrapper");
  const mobileSummaryHost = document.getElementById("mobile-summary-host");
  const summaryCard = sidebarWrapper && sidebarWrapper.querySelector(".well");

  function placeSummaryForViewport() {
    const isMobile = window.innerWidth <= 767;
    if (!summaryCard || !sidebarWrapper || !mobileSummaryHost) return;
    if (isMobile) {
      if (summaryCard.parentElement !== mobileSummaryHost) {
        mobileSummaryHost.appendChild(summaryCard);
      }
    } else {
      if (summaryCard.parentElement !== sidebarWrapper) {
        sidebarWrapper.appendChild(summaryCard);
      }
    }
  }
  placeSummaryForViewport();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(placeSummaryForViewport, 120);
  });

  // Guest Menu Toggles
  dom.guests.adultBtn.addEventListener("click", () => {
    showAdultMenu = !showAdultMenu;
    dom.guests.adultMenu.classList.toggle("hidden", !showAdultMenu);
    updateGuestButtonLabel("adult", adultCount, showAdultMenu);
    if (showAdultMenu) {
      // Hide other menu
      showChildMenu = false;
      dom.guests.childMenu.classList.add("hidden");
      updateGuestButtonLabel("child", childCount, false);
    }
  });

  dom.guests.childBtn.addEventListener("click", () => {
    showChildMenu = !showChildMenu;
    dom.guests.childMenu.classList.toggle("hidden", !showChildMenu);
    updateGuestButtonLabel("child", childCount, showChildMenu);
    if (showChildMenu) {
      // Hide other menu
      showAdultMenu = false;
      dom.guests.adultMenu.classList.add("hidden");
      updateGuestButtonLabel("adult", adultCount, false);
    }
  });

  // Guest Menu Selection (Delegation)
  dom.guests.adultMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) {
      adultCount = parseInt(btn.dataset.value, 10);
      updateGuestButtonLabel("adult", adultCount, false);
      showAdultMenu = false;
      dom.guests.adultMenu.classList.add("hidden");
      populateGuestMenus(); // Re-render to update active state
      updateBookingSummary();
      refreshPaySection(); // Update total
    }
  });

  dom.guests.childMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) {
      childCount = parseInt(btn.dataset.value, 10);
      updateGuestButtonLabel("child", childCount, false);
      showChildMenu = false;
      dom.guests.childMenu.classList.add("hidden");
      populateGuestMenus(); // Re-render to update active state
      updateBookingSummary();
      refreshPaySection(); // Update total
    }
  });

  // Departure time selection (radio inputs)
  if (dom.guests.dep1900) {
    dom.guests.dep1900.addEventListener("change", () => {
      if (dom.guests.dep1900.checked) {
        selectedDepartureTime = "19:00";
        updateDepartureButtons();
        updateProceedButtonsState();
      }
    });
  }
  if (dom.guests.dep1700) {
    dom.guests.dep1700.addEventListener("change", () => {
      if (dom.guests.dep1700.checked) {
        selectedDepartureTime = "17:00";
        updateDepartureButtons();
        updateProceedButtonsState();
      }
    });
  }

  // Upgrades (Delegation)
  dom.upgrades.container.addEventListener("click", (e) => {
    const target = e.target;
    const upgradeItem = target.closest("[data-upgrade-index]");
    if (!upgradeItem) return;

    const index = parseInt(upgradeItem.dataset.upgradeIndex, 10);
    const qty = selectedUpgradeQty[index] || 0;

    if (target.closest(".toggle-upgrade-details")) {
      expandedUpgrades[index] = !expandedUpgrades[index];
      upgradeItem
        .querySelector(".upgrade-description")
        .classList.toggle("hidden", !expandedUpgrades[index]);
    } else if (target.closest(".add-upgrade-btn")) {
      selectedUpgradeQty[index] = 1;
      renderUpgradesList(); // Re-render this section
      updateBookingSummary();
      refreshPaySection(); // Update total
    } else if (target.closest(".inc-upgrade-btn")) {
      selectedUpgradeQty[index] = Math.min(99, qty + 1);
      renderUpgradesList(); // Re-render this section
      updateBookingSummary();
      refreshPaySection(); // Update total
    } else if (target.closest(".dec-upgrade-btn")) {
      selectedUpgradeQty[index] = Math.max(0, qty - 1);
      renderUpgradesList(); // Re-render this section
      updateBookingSummary();
      refreshPaySection(); // Update total
    }
  });

  // Form Inputs
  Object.keys(dom.form).forEach((key) => {
    if (dom.form[key]) {
      dom.form[key].addEventListener("input", (e) => {
        formData[key] = e.target.value;
        // Clear error on input
        const formGroup = e.target.closest(".form-group");
        if (formGroup && formGroup.classList.contains("has-error")) {
          formGroup.classList.remove("has-error");
          const errorBlock = formGroup.querySelector(".help-block");
          if (errorBlock) {
            errorBlock.textContent = "";
          }
          // Clear object state
          if (formErrors[key]) {
            formErrors[key] = "";
          }
        }
      });
    }
  });

  // Form Submit
  if (dom.submitBtn) dom.submitBtn.addEventListener("click", handleSubmit);

  // Booking flow buttons
  if (dom.bookingFlow.proceedBtn) {
    dom.bookingFlow.proceedBtn.addEventListener("click", goToUpgrades);
  }
  if (dom.bookingFlow.skipBtn) {
    dom.bookingFlow.skipBtn.addEventListener("click", skipToSummary);
  }
  if (dom.bookingFlow.upgradesProceedPayBtn) {
    dom.bookingFlow.upgradesProceedPayBtn.addEventListener(
      "click",
      proceedToPayFromUpgrades
    );
  }

  // Payment interactions
  [
    dom.payments.payCard,
    dom.payments.payGPay,
    dom.payments.payApple,
  ].forEach((el) => {
    if (el) el.addEventListener("change", refreshPaySection);
  });
  if (dom.payments.cardType)
    dom.payments.cardType.addEventListener("change", refreshPaySection);

  // Coupon toggle and apply
  if (dom.coupon.toggle && dom.coupon.box) {
    dom.coupon.toggle.addEventListener("click", (e) => {
      e.preventDefault();
      dom.coupon.box.classList.toggle("hidden");
      if (!dom.coupon.box.classList.contains("hidden") && dom.coupon.input) {
        dom.coupon.input.focus();
      }
    });
  }
  if (dom.coupon.apply) {
    dom.coupon.apply.addEventListener("click", () => {
      const code = (dom.coupon.input?.value || "").trim();
      if (!code) {
        if (dom.coupon.msg) {
          dom.coupon.msg.textContent = "Please enter a coupon code.";
          dom.coupon.msg.className = "text-xs text-danger";
        }
        return;
      }
      // Stub: validate/apply coupon here
      if (dom.coupon.msg) {
        dom.coupon.msg.textContent = `Applied coupon: ${code}`;
        dom.coupon.msg.className = "text-s text-primary-custom";
      }
    });
  }

  // --- INITIALIZATION ---
  function init() {
    renderStaticData();
    populateGuestMenus();
    renderUpgradesList();
    updateBookingSummary();
    // Ensure initial labels preserve chevron icons (closed state)
    updateGuestButtonLabel("adult", adultCount, false);
    updateGuestButtonLabel("child", childCount, false);
    // Disable later sections until Booking Details complete
    setAccordionEnabled("upgrades", false);
    setAccordionEnabled("bookingSummary", false);
    refreshPaySection();
    updateDepartureButtons();
    updateProceedButtonsState();
  }

  init();

  // Mount PriceCalendar
  const mountPoint = document.getElementById("cruise-calendar");
  if (mountPoint) {
    const now = new Date();
    const calendar = new PriceCalendar(mountPoint, {
      currency: "",
      startDate: now,
      minDate: now,
      maxDate: new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()),
    });
    calendar.setDefaultPrice(185);
    calendar.setBulkPrices({
      "2025-10-28": 185,
      "2025-10-29": 185,
      "2025-10-30": 185,
      "2025-10-31": 185,
    });
    calendar.setUnavailable(["2025-10-05", "2025-10-12", "2025-10-19"]);
    calendar.onSelect = (iso /*, price*/) => {
      selectedDate = iso;
      if (formErrors.date) {
        dom.calendar.error.textContent = "";
        formErrors.date = "";
      }
      updateBookingSummary();
      updateProceedButtonsState();
    };
    // Expose for debugging if needed
    window.priceCalendar = calendar;

    // Mobile date input for screens under 460px
    if (window.innerWidth < 460) {
      const calendarWrapper = mountPoint.closest('.calendar-wrapper');
      if (calendarWrapper) {
        // Create mobile date input
        const mobileInput = document.createElement('input');
        mobileInput.type = 'date';
        mobileInput.id = 'mobile-date-input';
        mobileInput.className = 'form-control input-lg';
        mobileInput.style.cssText = 'width: 100%; height: 46px; padding: 10px 40px 10px 16px; font-size: 16px; border: 1px solid #ced4da;';
        
        // Set min and max dates
        const minDate = calendar.minDate || now;
        const maxDate = calendar.maxDate || new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
        mobileInput.min = minDate.toISOString().split('T')[0];
        mobileInput.max = maxDate.toISOString().split('T')[0];
        
        // Sync mobile input with calendar
        mobileInput.addEventListener('change', (e) => {
          const selectedISO = e.target.value;
          if (selectedISO) {
            calendar.selected = selectedISO;
            selectedDate = selectedISO;
            if (formErrors.date) {
              dom.calendar.error.textContent = "";
              formErrors.date = "";
            }
            updateBookingSummary();
            updateProceedButtonsState();
          }
        });
        
        // Insert mobile input before calendar
        mountPoint.parentNode.insertBefore(mobileInput, mountPoint);
      }
    }
  }
});