// site.config.js — пункты для редактирования (телефон, почта, Telegram)
export const SITE = {
  phone: "+7 903 720 24 99",
  email: "ovsyannikov002@gmail.com",
  telegramWrite: "https://t.me/vizioner959",    // куда писать (личное сообщение / бот)
  telegramChannel: "https://t.me/vizioner959" // канал / паблик (ссылка в футере)
};

// автоподстановка
export function applySiteConfig(){
  document.documentElement.dataset.telegram = SITE.telegramWrite;
  const footers = document.querySelectorAll("footer .footer");
  footers.forEach(f=>{
    const span = f.querySelector("span");
    if (span) span.textContent = ` ${SITE.phone} · ${SITE.email}`;
    const a = f.querySelector('a[href^="https://t.me/"]');
    if (a) a.href = SITE.telegramChannel;
  });
  const mail = document.querySelectorAll('a[href^="mailto:"]');
  mail.forEach(a=>{
    a.href = `mailto:${SITE.email}`;
    a.textContent = SITE.email;
  });
}
