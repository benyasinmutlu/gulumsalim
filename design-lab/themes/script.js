const THEME_COPY = {
  ivory: {
    name: "Sıcak Fildişi",
    themeColor: "#f7f3ed",
  },
  cashmere: {
    name: "Kaşmir",
    themeColor: "#f4f0e9",
  },
  gallery: {
    name: "Galeri",
    themeColor: "#fbfaf7",
  },
};

const ACCOUNT_COPY = {
  individual: {
    eyebrow: "Bireysel üyelik",
    title: "Kendi dolabınla başla.",
    description: "Birkaç adımda hesap oluştur, ilanını hazırla ve kazancın için IBAN bilgini güvenle ekle.",
  },
  corporate: {
    eyebrow: "Kurumsal üyelik",
    title: "Mağazanı yeni müşterilerle buluştur.",
    description: "Toplu ürün yükleme, kampanya yönetimi ve yapay zekâ desteğiyle koleksiyonunu profesyonelce yönet.",
  },
};

const themeButtons = Array.from(document.querySelectorAll("[data-theme-value]"));
const themeName = document.querySelector("#theme-name");
const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');

function setTheme(theme) {
  if (!THEME_COPY[theme]) return;

  document.documentElement.dataset.theme = theme;
  themeName.textContent = THEME_COPY[theme].name;
  colorSchemeMeta.content = "light";

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("theme", theme);
  window.history.replaceState({}, "", nextUrl);

  themeButtons.forEach((button) => {
    const selected = button.dataset.themeValue === theme;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  try {
    window.localStorage.setItem("gulumsalim-theme-lab", theme);
  } catch {
    // Tema tercihi yalnız bu statik laboratuvara aittir; depolama kapalıysa sessizce devam eder.
  }
}

themeButtons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.themeValue));
});

const urlTheme = new URLSearchParams(window.location.search).get("theme");

if (urlTheme && THEME_COPY[urlTheme]) {
  setTheme(urlTheme);
} else {
  try {
    const savedTheme = window.localStorage.getItem("gulumsalim-theme-lab");
    if (savedTheme && THEME_COPY[savedTheme]) setTheme(savedTheme);
  } catch {
    // Tarayıcı depolaması kullanılamadığında varsayılan tema korunur.
  }
}

const accountButtons = Array.from(document.querySelectorAll("[data-account-type]"));
const authPanel = document.querySelector("#auth-fields");
const authEyebrow = document.querySelector("#auth-eyebrow");
const authTitle = document.querySelector("#auth-panel-title");
const authDescription = document.querySelector("#auth-description");
const corporateFields = Array.from(document.querySelectorAll(".corporate-only"));

function setAccountType(type) {
  const copy = ACCOUNT_COPY[type];
  if (!copy) return;

  authEyebrow.textContent = copy.eyebrow;
  authTitle.textContent = copy.title;
  authDescription.textContent = copy.description;

  accountButtons.forEach((button) => {
    const selected = button.dataset.accountType === type;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });

  const activeButton = accountButtons.find((button) => button.dataset.accountType === type);
  authPanel.setAttribute("aria-labelledby", activeButton.id);
  corporateFields.forEach((field) => {
    field.hidden = type !== "corporate";
  });
}

accountButtons.forEach((button, index) => {
  button.addEventListener("click", () => setAccountType(button.dataset.accountType));
  button.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + accountButtons.length) % accountButtons.length;
    accountButtons[nextIndex].focus();
    setAccountType(accountButtons[nextIndex].dataset.accountType);
  });
});

document.querySelectorAll(".media-shell img").forEach((image) => {
  const markFallback = () => image.closest(".media-shell")?.classList.add("is-fallback");
  image.addEventListener("error", markFallback);
  if (image.complete && image.naturalWidth === 0) markFallback();
});
